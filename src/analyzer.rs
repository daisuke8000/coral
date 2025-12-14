//! FileDescriptorSet → GraphModel 変換

use std::collections::HashMap;

use prost_types::FileDescriptorSet;

use crate::domain::{
    Edge, EnumInfo, EnumValue, FieldInfo, GraphModel, MethodSignature, Node, NodeDetails, NodeType,
    Package,
};

pub struct Analyzer {
    file_to_node_id: HashMap<String, String>,
}

impl Analyzer {
    pub fn new() -> Self {
        Self {
            file_to_node_id: HashMap::new(),
        }
    }

    #[must_use]
    pub fn analyze(&mut self, fds: &FileDescriptorSet) -> GraphModel {
        let mut model = GraphModel::new();

        for file in &fds.file {
            if let Some(node) = self.create_node(file) {
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

        model.packages = self.group_packages(&model.nodes);
        model
    }

    fn create_node(&self, file: &prost_types::FileDescriptorProto) -> Option<Node> {
        let file_name = file.name.as_deref()?;
        let package = file.package.as_deref().unwrap_or("");
        let has_service = !file.service.is_empty();
        let node_type = self.classify_file(file_name, has_service);
        let label = self.extract_label(file_name);
        let id = self.generate_node_id(package, &label);
        let details = self.extract_details(file, &node_type);

        Some(Node::new(
            id,
            node_type,
            package.to_string(),
            label,
            file_name.to_string(),
            details,
        ))
    }

    fn classify_file(&self, file_path: &str, has_service: bool) -> NodeType {
        if file_path.starts_with("google/") || file_path.starts_with("buf/") {
            NodeType::External
        } else if has_service {
            NodeType::Service
        } else {
            NodeType::Message
        }
    }

    fn extract_label(&self, file_name: &str) -> String {
        file_name
            .rsplit('/')
            .next()
            .unwrap_or(file_name)
            .trim_end_matches(".proto")
            .to_string()
    }

    fn generate_node_id(&self, package: &str, label: &str) -> String {
        if package.is_empty() {
            label.to_string()
        } else {
            format!("{}/{}", package, label)
        }
    }

    fn extract_details(
        &self,
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
                            input_type: self.extract_short_type(m.input_type.as_ref()),
                            output_type: self.extract_short_type(m.output_type.as_ref()),
                        })
                    })
                    .collect();
                NodeDetails::Service { methods }
            }
            NodeType::Message => {
                let fields = file
                    .message_type
                    .iter()
                    .flat_map(|m| {
                        m.field.iter().map(|f| FieldInfo {
                            name: f.name.clone().unwrap_or_default(),
                            number: f.number.unwrap_or(0),
                            type_name: self.type_to_string(f.r#type, f.type_name.as_ref()),
                            label: self.label_to_string(f.label),
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

    /// ".user.v1.GetUserRequest" → "GetUserRequest"
    fn extract_short_type(&self, full_type: Option<&String>) -> String {
        full_type
            .map(|t| t.rsplit('.').next().unwrap_or(t).to_string())
            .unwrap_or_default()
    }

    fn label_to_string(&self, label: Option<i32>) -> String {
        match label {
            Some(2) => "required".to_string(),
            Some(3) => "repeated".to_string(),
            _ => "optional".to_string(),
        }
    }

    fn type_to_string(&self, field_type: Option<i32>, type_name: Option<&String>) -> String {
        if let Some(name) = type_name
            && !name.is_empty()
        {
            return self.extract_short_type(Some(name));
        }

        match field_type {
            Some(1) => "double".to_string(),
            Some(2) => "float".to_string(),
            Some(3) => "int64".to_string(),
            Some(4) => "uint64".to_string(),
            Some(5) => "int32".to_string(),
            Some(6) => "fixed64".to_string(),
            Some(7) => "fixed32".to_string(),
            Some(8) => "bool".to_string(),
            Some(9) => "string".to_string(),
            Some(10) => "group".to_string(),
            Some(11) => "message".to_string(),
            Some(12) => "bytes".to_string(),
            Some(13) => "uint32".to_string(),
            Some(14) => "enum".to_string(),
            Some(15) => "sfixed32".to_string(),
            Some(16) => "sfixed64".to_string(),
            Some(17) => "sint32".to_string(),
            Some(18) => "sint64".to_string(),
            _ => "unknown".to_string(),
        }
    }

    fn create_edges(&self, file: &prost_types::FileDescriptorProto) -> Vec<Edge> {
        let mut edges = Vec::new();

        let source_id = match file.name.as_ref().and_then(|n| self.file_to_node_id.get(n)) {
            Some(id) => id.clone(),
            None => return edges,
        };

        for dep in &file.dependency {
            if let Some(target_id) = self.file_to_node_id.get(dep) {
                edges.push(Edge::new(source_id.clone(), target_id.clone()));
            }
        }

        edges
    }

    fn group_packages(&self, nodes: &[Node]) -> Vec<Package> {
        let mut package_map: HashMap<String, Vec<String>> = HashMap::new();

        for node in nodes {
            package_map
                .entry(node.package.clone())
                .or_default()
                .push(node.id.clone());
        }

        package_map
            .into_iter()
            .map(|(id, node_ids)| Package::new(id.clone(), id, node_ids))
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
        let analyzer = Analyzer::new();
        assert_eq!(analyzer.classify_file("google/protobuf/timestamp.proto", false), NodeType::External);
        assert_eq!(analyzer.classify_file("buf/validate/validate.proto", false), NodeType::External);
        assert_eq!(analyzer.classify_file("user/v1/user.proto", true), NodeType::Service);
        assert_eq!(analyzer.classify_file("user/v1/types.proto", false), NodeType::Message);
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

        let payment = graph.nodes.iter().find(|n| n.id == "payment.v1/payment").unwrap();
        let user = graph.nodes.iter().find(|n| n.id == "user.v1/user").unwrap();
        let timestamp = graph.nodes.iter().find(|n| n.id == "google.protobuf/timestamp").unwrap();

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
