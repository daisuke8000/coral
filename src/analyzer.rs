//! Analyzer module for converting FileDescriptorSet to GraphModel.

use std::collections::HashMap;

use prost_types::FileDescriptorSet;
use prost_types::field_descriptor_proto::{Label, Type};

use crate::domain::{
    Edge, EnumInfo, EnumValue, FieldInfo, GraphModel, MessageDef, MethodSignature, Node, NodeDetails, NodeType,
    Package,
};

pub struct Analyzer {
    file_to_node_id: HashMap<String, String>,
}

impl Analyzer {
    #[must_use]
    pub fn new() -> Self {
        Self {
            file_to_node_id: HashMap::new(),
        }
    }

    #[must_use]
    pub fn analyze(&mut self, fds: &FileDescriptorSet) -> GraphModel {
        let mut model = GraphModel::new();

        for file in &fds.file {
            if let Some(node) = Self::create_node(file) {
                if let Some(file_name) = &file.name {
                    self.file_to_node_id
                        .insert(file_name.clone(), node.id.clone());
                }
                model.nodes.push(node);
            }
        }

        for file in &fds.file {
            model.edges.extend(self.create_edges(file));
        }

        model.packages = Self::group_packages(&model.nodes);
        model
    }

    fn create_node(file: &prost_types::FileDescriptorProto) -> Option<Node> {
        let file_name = file.name.as_deref()?;
        let package = file.package.as_deref().unwrap_or("");
        let has_service = !file.service.is_empty();
        let node_type = Self::classify_file(file_name, has_service);
        let label = Self::extract_label(file_name);
        let id = Self::generate_node_id(package, &label);
        let details = Self::extract_details(file, &node_type);

        Some(Node::new(
            id,
            node_type,
            package.to_string(),
            label,
            file_name.to_string(),
            details,
        ))
    }

    /// Files in `google/` or `buf/` → External, with service → Service, otherwise → Message.
    fn classify_file(file_path: &str, has_service: bool) -> NodeType {
        if file_path.starts_with("google/") || file_path.starts_with("buf/") {
            NodeType::External
        } else if has_service {
            NodeType::Service
        } else {
            NodeType::Message
        }
    }

    /// `"user/v1/user.proto"` → `"user"`
    fn extract_label(file_name: &str) -> String {
        file_name
            .rsplit('/')
            .next()
            .unwrap_or(file_name)
            .trim_end_matches(".proto")
            .to_string()
    }

    /// `("user.v1", "user")` → `"user.v1/user"`
    fn generate_node_id(package: &str, label: &str) -> String {
        if package.is_empty() {
            label.to_string()
        } else {
            format!("{package}/{label}")
        }
    }

    fn extract_details(
        file: &prost_types::FileDescriptorProto,
        node_type: &NodeType,
    ) -> NodeDetails {
        match node_type {
            NodeType::Service => {
                let methods = file
                    .service
                    .iter()
                    .flat_map(|svc| {
                        svc.method.iter().map(|m| MethodSignature {
                            name: m.name.clone().unwrap_or_default(),
                            input_type: Self::extract_short_type(m.input_type.as_ref()),
                            output_type: Self::extract_short_type(m.output_type.as_ref()),
                        })
                    })
                    .collect();

                // Extract message definitions (Request/Response types)
                let messages = file
                    .message_type
                    .iter()
                    .map(|m| MessageDef {
                        name: m.name.clone().unwrap_or_default(),
                        fields: m
                            .field
                            .iter()
                            .map(|f| FieldInfo {
                                name: f.name.clone().unwrap_or_default(),
                                number: f.number.unwrap_or(0),
                                type_name: Self::type_to_string(f.r#type, f.type_name.as_ref()),
                                label: Self::label_to_string(f.label),
                            })
                            .collect(),
                    })
                    .collect();

                NodeDetails::Service { methods, messages }
            }
            NodeType::Message => {
                let fields = file
                    .message_type
                    .iter()
                    .flat_map(|m| {
                        m.field.iter().map(|f| FieldInfo {
                            name: f.name.clone().unwrap_or_default(),
                            number: f.number.unwrap_or(0),
                            type_name: Self::type_to_string(f.r#type, f.type_name.as_ref()),
                            label: Self::label_to_string(f.label),
                        })
                    })
                    .collect();

                let enums = file
                    .enum_type
                    .iter()
                    .map(|e| EnumInfo {
                        name: e.name.clone().unwrap_or_default(),
                        values: e
                            .value
                            .iter()
                            .map(|v| EnumValue {
                                name: v.name.clone().unwrap_or_default(),
                                number: v.number.unwrap_or(0),
                            })
                            .collect(),
                    })
                    .collect();

                NodeDetails::Message { fields, enums }
            }
            NodeType::External => NodeDetails::External,
        }
    }

    /// `".user.v1.GetUserRequest"` → `"GetUserRequest"`
    fn extract_short_type(full_type: Option<&String>) -> String {
        full_type
            .map(|t| t.rsplit('.').next().unwrap_or(t).to_string())
            .unwrap_or_default()
    }

    fn label_to_string(label: Option<i32>) -> String {
        label
            .and_then(|l| Label::try_from(l).ok())
            .map(|l| match l {
                Label::Optional => "optional",
                Label::Required => "required",
                Label::Repeated => "repeated",
            })
            .unwrap_or("optional")
            .to_string()
    }

    fn type_to_string(field_type: Option<i32>, type_name: Option<&String>) -> String {
        if let Some(name) = type_name.filter(|n| !n.is_empty()) {
            return Self::extract_short_type(Some(name));
        }

        field_type
            .and_then(|t| Type::try_from(t).ok())
            .map(|t| match t {
                Type::Double => "double",
                Type::Float => "float",
                Type::Int64 => "int64",
                Type::Uint64 => "uint64",
                Type::Int32 => "int32",
                Type::Fixed64 => "fixed64",
                Type::Fixed32 => "fixed32",
                Type::Bool => "bool",
                Type::String => "string",
                Type::Group => "group",
                Type::Message => "message",
                Type::Bytes => "bytes",
                Type::Uint32 => "uint32",
                Type::Enum => "enum",
                Type::Sfixed32 => "sfixed32",
                Type::Sfixed64 => "sfixed64",
                Type::Sint32 => "sint32",
                Type::Sint64 => "sint64",
            })
            .unwrap_or("unknown")
            .to_string()
    }

    fn create_edges(&self, file: &prost_types::FileDescriptorProto) -> Vec<Edge> {
        let source_id = match file.name.as_ref().and_then(|n| self.file_to_node_id.get(n)) {
            Some(id) => id,
            None => return Vec::new(),
        };

        file.dependency
            .iter()
            .filter_map(|dep| self.file_to_node_id.get(dep))
            .map(|target_id| Edge::new(source_id.clone(), target_id.clone()))
            .collect()
    }

    fn group_packages(nodes: &[Node]) -> Vec<Package> {
        let mut package_map: HashMap<String, Vec<String>> = HashMap::new();

        for node in nodes {
            package_map
                .entry(node.package.clone())
                .or_default()
                .push(node.id.clone());
        }

        package_map
            .into_iter()
            .map(|(id, node_ids)| Package::new(id, node_ids))
            .collect()
    }
}

impl Default for Analyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use prost_types::FileDescriptorProto;

    use super::*;

    #[test]
    fn test_classify_file() {
        assert_eq!(
            Analyzer::classify_file("google/protobuf/timestamp.proto", false),
            NodeType::External
        );
        assert_eq!(
            Analyzer::classify_file("buf/validate/validate.proto", false),
            NodeType::External
        );
        assert_eq!(
            Analyzer::classify_file("user/v1/user.proto", true),
            NodeType::Service
        );
        assert_eq!(
            Analyzer::classify_file("user/v1/types.proto", false),
            NodeType::Message
        );
    }

    #[test]
    fn test_analyze() {
        let fds = FileDescriptorSet {
            file: vec![
                FileDescriptorProto {
                    name: Some("payment/v1/payment.proto".to_string()),
                    package: Some("payment.v1".to_string()),
                    service: vec![prost_types::ServiceDescriptorProto::default()],
                    dependency: vec![
                        "user/v1/user.proto".to_string(),
                        "google/protobuf/timestamp.proto".to_string(),
                    ],
                    ..Default::default()
                },
                FileDescriptorProto {
                    name: Some("user/v1/user.proto".to_string()),
                    package: Some("user.v1".to_string()),
                    dependency: vec!["google/protobuf/timestamp.proto".to_string()],
                    ..Default::default()
                },
                FileDescriptorProto {
                    name: Some("google/protobuf/timestamp.proto".to_string()),
                    package: Some("google.protobuf".to_string()),
                    ..Default::default()
                },
            ],
        };

        let mut analyzer = Analyzer::new();
        let graph = analyzer.analyze(&fds);

        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.edges.len(), 3);
        assert_eq!(graph.packages.len(), 3);

        let payment = graph
            .nodes
            .iter()
            .find(|n| n.id == "payment.v1/payment")
            .unwrap();
        let user = graph.nodes.iter().find(|n| n.id == "user.v1/user").unwrap();
        let timestamp = graph
            .nodes
            .iter()
            .find(|n| n.id == "google.protobuf/timestamp")
            .unwrap();

        assert_eq!(payment.node_type, NodeType::Service);
        assert_eq!(user.node_type, NodeType::Message);
        assert_eq!(timestamp.node_type, NodeType::External);
    }

    #[test]
    fn test_analyze_empty() {
        let fds = FileDescriptorSet { file: vec![] };
        let mut analyzer = Analyzer::new();
        let graph = analyzer.analyze(&fds);

        assert!(graph.nodes.is_empty());
        assert!(graph.edges.is_empty());
        assert!(graph.packages.is_empty());
    }
}
