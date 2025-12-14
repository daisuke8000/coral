//! Analyzer module for converting FileDescriptorSet to GraphModel.

use std::collections::{HashMap, HashSet};

use prost_types::FileDescriptorSet;
use prost_types::field_descriptor_proto::{Label, Type};

use crate::domain::{
    Edge, EnumValue, FieldInfo, GraphModel, MessageDef, MethodSignature, Node, NodeDetails,
    NodeType, Package,
};

/// Analyzer creates definition-level nodes (Service, Message, Enum) from protobuf descriptors.
/// Each Service, Message, and Enum definition becomes its own graph node.
/// Edges are created based on field type references between definitions.
pub struct Analyzer {
    /// Maps fully-qualified type name to node ID (e.g., ".user.v1.User" → "user.v1.User")
    type_to_node_id: HashMap<String, String>,
    /// Maps fully-qualified type name to MessageDef for expandable RPC method fields
    type_to_message_def: HashMap<String, MessageDef>,
    /// Tracks external packages (google.*, buf.*) for External node creation
    external_packages: HashSet<String>,
}

impl Analyzer {
    #[must_use]
    pub fn new() -> Self {
        Self {
            type_to_node_id: HashMap::new(),
            type_to_message_def: HashMap::new(),
            external_packages: HashSet::new(),
        }
    }

    #[must_use]
    pub fn analyze(&mut self, fds: &FileDescriptorSet) -> GraphModel {
        let mut model = GraphModel::new();

        // First pass: Create Message/Enum nodes and build type mappings
        // (Service nodes need message definitions, so messages must be processed first)
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            let package = file.package.as_deref().unwrap_or("");
            let is_external = Self::is_external_file(file_name);

            // Create Message nodes (skip external files - just track their types)
            for message in &file.message_type {
                if is_external {
                    self.register_external_type(message, package);
                } else if let Some(node) = self.create_message_node(message, package, file_name) {
                    model.nodes.push(node);
                }
            }

            // Create Enum nodes (skip external files - just track their types)
            for enum_type in &file.enum_type {
                if is_external {
                    self.register_external_enum(enum_type, package);
                } else if let Some(node) = self.create_enum_node(enum_type, package, file_name) {
                    model.nodes.push(node);
                }
            }
        }

        // Second pass: Create Service nodes (now message definitions are available)
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            let package = file.package.as_deref().unwrap_or("");

            for service in &file.service {
                if let Some(node) = self.create_service_node(service, package, file_name) {
                    model.nodes.push(node);
                }
            }
        }

        // Third pass: Create edges based on field type references
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            if Self::is_external_file(file_name) {
                continue;
            }

            let package = file.package.as_deref().unwrap_or("");

            // Edges from Service RPC methods
            for service in &file.service {
                model
                    .edges
                    .extend(self.create_service_edges(service, package));
            }

            // Edges from Message fields
            for message in &file.message_type {
                model
                    .edges
                    .extend(self.create_message_edges(message, package, &mut model.nodes));
            }
        }

        // Deduplicate edges
        model.edges = Self::deduplicate_edges(model.edges);

        model.packages = Self::group_packages(&model.nodes);
        model
    }

    fn is_external_file(file_path: &str) -> bool {
        file_path.starts_with("google/") || file_path.starts_with("buf/")
    }

    /// Generate node ID: `{package}.{name}` or just `{name}` if no package
    fn generate_node_id(package: &str, name: &str) -> String {
        if package.is_empty() {
            name.to_string()
        } else {
            format!("{package}.{name}")
        }
    }

    /// Generate fully-qualified type name for internal tracking: `.{package}.{name}`
    fn generate_fq_type(package: &str, name: &str) -> String {
        if package.is_empty() {
            format!(".{name}")
        } else {
            format!(".{package}.{name}")
        }
    }

    fn create_service_node(
        &mut self,
        service: &prost_types::ServiceDescriptorProto,
        package: &str,
        file_name: &str,
    ) -> Option<Node> {
        let name = service.name.as_ref()?;
        let id = Self::generate_node_id(package, name);
        let fq_type = Self::generate_fq_type(package, name);
        self.type_to_node_id.insert(fq_type, id.clone());

        let methods: Vec<MethodSignature> = service
            .method
            .iter()
            .map(|m| MethodSignature {
                name: m.name.clone().unwrap_or_default(),
                input_type: Self::extract_short_type(m.input_type.as_ref()),
                output_type: Self::extract_short_type(m.output_type.as_ref()),
            })
            .collect();

        // Collect message definitions for input/output types (for expandable RPC fields)
        let mut seen_types = HashSet::new();
        let mut messages = Vec::new();
        for method in &service.method {
            for type_name in [&method.input_type, &method.output_type].into_iter().flatten() {
                if seen_types.insert(type_name.clone()) {
                    if let Some(msg_def) = self.type_to_message_def.get(type_name) {
                        messages.push(msg_def.clone());
                    }
                }
            }
        }

        Some(Node::new(
            id,
            NodeType::Service,
            package.to_string(),
            name.clone(),
            file_name.to_string(),
            NodeDetails::Service { methods, messages },
        ))
    }

    fn create_message_node(
        &mut self,
        message: &prost_types::DescriptorProto,
        package: &str,
        file_name: &str,
    ) -> Option<Node> {
        let name = message.name.as_ref()?;
        let id = Self::generate_node_id(package, name);
        let fq_type = Self::generate_fq_type(package, name);
        self.type_to_node_id.insert(fq_type.clone(), id.clone());

        // Also register nested types
        for nested in &message.nested_type {
            self.register_nested_message(nested, &fq_type);
        }
        for nested_enum in &message.enum_type {
            self.register_nested_enum(nested_enum, &fq_type);
        }

        let fields: Vec<FieldInfo> = message
            .field
            .iter()
            .map(|f| FieldInfo {
                name: f.name.clone().unwrap_or_default(),
                number: f.number.unwrap_or(0),
                type_name: Self::type_to_string(f.r#type, f.type_name.as_ref()),
                label: Self::label_to_string(f.label),
            })
            .collect();

        // Register MessageDef for expandable RPC method fields
        self.type_to_message_def.insert(
            fq_type,
            MessageDef {
                name: name.clone(),
                fields: fields.clone(),
            },
        );

        Some(Node::new(
            id,
            NodeType::Message,
            package.to_string(),
            name.clone(),
            file_name.to_string(),
            NodeDetails::Message { fields },
        ))
    }

    fn create_enum_node(
        &mut self,
        enum_type: &prost_types::EnumDescriptorProto,
        package: &str,
        file_name: &str,
    ) -> Option<Node> {
        let name = enum_type.name.as_ref()?;
        let id = Self::generate_node_id(package, name);
        let fq_type = Self::generate_fq_type(package, name);
        self.type_to_node_id.insert(fq_type, id.clone());

        let values = enum_type
            .value
            .iter()
            .map(|v| EnumValue {
                name: v.name.clone().unwrap_or_default(),
                number: v.number.unwrap_or(0),
            })
            .collect();

        Some(Node::new(
            id,
            NodeType::Enum,
            package.to_string(),
            name.clone(),
            file_name.to_string(),
            NodeDetails::Enum { values },
        ))
    }

    fn register_external_type(&mut self, message: &prost_types::DescriptorProto, package: &str) {
        if let Some(name) = &message.name {
            let id = Self::generate_node_id(package, name);
            let fq_type = Self::generate_fq_type(package, name);
            self.type_to_node_id.insert(fq_type.clone(), id);
            self.external_packages.insert(package.to_string());

            // Register nested types
            for nested in &message.nested_type {
                self.register_nested_message(nested, &fq_type);
            }
        }
    }

    fn register_external_enum(
        &mut self,
        enum_type: &prost_types::EnumDescriptorProto,
        package: &str,
    ) {
        if let Some(name) = &enum_type.name {
            let id = Self::generate_node_id(package, name);
            let fq_type = Self::generate_fq_type(package, name);
            self.type_to_node_id.insert(fq_type, id);
            self.external_packages.insert(package.to_string());
        }
    }

    fn register_nested_message(&mut self, message: &prost_types::DescriptorProto, parent_fq: &str) {
        if let Some(name) = &message.name {
            // Nested type FQ: .package.Parent.Nested
            let fq_type = format!("{parent_fq}.{name}");
            // Node ID uses dot notation: package.Parent.Nested
            let id = fq_type.trim_start_matches('.').to_string();
            self.type_to_node_id.insert(fq_type.clone(), id);

            for nested in &message.nested_type {
                self.register_nested_message(nested, &fq_type);
            }
        }
    }

    fn register_nested_enum(
        &mut self,
        enum_type: &prost_types::EnumDescriptorProto,
        parent_fq: &str,
    ) {
        if let Some(name) = &enum_type.name {
            let fq_type = format!("{parent_fq}.{name}");
            let id = fq_type.trim_start_matches('.').to_string();
            self.type_to_node_id.insert(fq_type, id);
        }
    }

    fn create_service_edges(
        &self,
        service: &prost_types::ServiceDescriptorProto,
        package: &str,
    ) -> Vec<Edge> {
        let service_name = match &service.name {
            Some(n) => n,
            None => return Vec::new(),
        };
        let source_id = Self::generate_node_id(package, service_name);

        let mut edges = Vec::new();
        for method in &service.method {
            // Edge to input type
            if let Some(input_type) = &method.input_type
                && let Some(target_id) = self.type_to_node_id.get(input_type)
            {
                edges.push(Edge::new(source_id.clone(), target_id.clone()));
            }
            // Edge to output type
            if let Some(output_type) = &method.output_type
                && let Some(target_id) = self.type_to_node_id.get(output_type)
            {
                edges.push(Edge::new(source_id.clone(), target_id.clone()));
            }
        }
        edges
    }

    fn create_message_edges(
        &self,
        message: &prost_types::DescriptorProto,
        package: &str,
        nodes: &mut Vec<Node>,
    ) -> Vec<Edge> {
        let message_name = match &message.name {
            Some(n) => n,
            None => return Vec::new(),
        };
        let source_id = Self::generate_node_id(package, message_name);

        let mut edges = Vec::new();
        for field in &message.field {
            if let Some(type_name) = &field.type_name
                && let Some(target_id) = self.type_to_node_id.get(type_name)
            {
                // Create External node if referenced type is from external package
                if self.is_external_type(type_name) {
                    self.ensure_external_node(target_id, type_name, nodes);
                }
                edges.push(Edge::new(source_id.clone(), target_id.clone()));
            }
        }
        edges
    }

    fn is_external_type(&self, fq_type: &str) -> bool {
        // Check if type starts with external packages
        let type_without_dot = fq_type.trim_start_matches('.');
        type_without_dot.starts_with("google.") || type_without_dot.starts_with("buf.")
    }

    fn ensure_external_node(&self, id: &str, fq_type: &str, nodes: &mut Vec<Node>) {
        // Check if External node already exists
        if nodes.iter().any(|n| n.id == id) {
            return;
        }

        let type_without_dot = fq_type.trim_start_matches('.');
        let parts: Vec<&str> = type_without_dot.rsplitn(2, '.').collect();
        let (label, package) = if parts.len() == 2 {
            (parts[0].to_string(), parts[1].to_string())
        } else {
            (type_without_dot.to_string(), String::new())
        };

        // Determine file path from package
        let file = format!("{}.proto", package.replace('.', "/"));

        nodes.push(Node::new(
            id.to_string(),
            NodeType::External,
            package,
            label,
            file,
            NodeDetails::External,
        ));
    }

    fn deduplicate_edges(edges: Vec<Edge>) -> Vec<Edge> {
        let mut seen = HashSet::new();
        edges
            .into_iter()
            .filter(|e| seen.insert((e.source.clone(), e.target.clone())))
            .collect()
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
    use prost_types::{
        DescriptorProto, EnumDescriptorProto, EnumValueDescriptorProto, FieldDescriptorProto,
        FileDescriptorProto, MethodDescriptorProto, ServiceDescriptorProto,
    };

    use super::*;

    #[test]
    fn test_definition_level_nodes() {
        let fds = FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("user/v1/user.proto".to_string()),
                package: Some("user.v1".to_string()),
                service: vec![ServiceDescriptorProto {
                    name: Some("UserService".to_string()),
                    method: vec![MethodDescriptorProto {
                        name: Some("GetUser".to_string()),
                        input_type: Some(".user.v1.GetUserRequest".to_string()),
                        output_type: Some(".user.v1.User".to_string()),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                message_type: vec![
                    DescriptorProto {
                        name: Some("GetUserRequest".to_string()),
                        field: vec![FieldDescriptorProto {
                            name: Some("user_id".to_string()),
                            number: Some(1),
                            r#type: Some(Type::String as i32),
                            ..Default::default()
                        }],
                        ..Default::default()
                    },
                    DescriptorProto {
                        name: Some("User".to_string()),
                        field: vec![
                            FieldDescriptorProto {
                                name: Some("id".to_string()),
                                number: Some(1),
                                r#type: Some(Type::String as i32),
                                ..Default::default()
                            },
                            FieldDescriptorProto {
                                name: Some("status".to_string()),
                                number: Some(2),
                                r#type: Some(Type::Enum as i32),
                                type_name: Some(".user.v1.UserStatus".to_string()),
                                ..Default::default()
                            },
                        ],
                        ..Default::default()
                    },
                ],
                enum_type: vec![EnumDescriptorProto {
                    name: Some("UserStatus".to_string()),
                    value: vec![
                        EnumValueDescriptorProto {
                            name: Some("UNKNOWN".to_string()),
                            number: Some(0),
                            ..Default::default()
                        },
                        EnumValueDescriptorProto {
                            name: Some("ACTIVE".to_string()),
                            number: Some(1),
                            ..Default::default()
                        },
                    ],
                    ..Default::default()
                }],
                ..Default::default()
            }],
        };

        let mut analyzer = Analyzer::new();
        let graph = analyzer.analyze(&fds);

        // Should have 4 nodes: 1 Service + 2 Messages + 1 Enum
        assert_eq!(graph.nodes.len(), 4);

        // Check Service node
        let service = graph
            .nodes
            .iter()
            .find(|n| n.id == "user.v1.UserService")
            .expect("Service node should exist");
        assert_eq!(service.node_type, NodeType::Service);
        assert_eq!(service.label, "UserService");

        // Check Message nodes
        let request = graph
            .nodes
            .iter()
            .find(|n| n.id == "user.v1.GetUserRequest")
            .expect("Request message should exist");
        assert_eq!(request.node_type, NodeType::Message);

        let user = graph
            .nodes
            .iter()
            .find(|n| n.id == "user.v1.User")
            .expect("User message should exist");
        assert_eq!(user.node_type, NodeType::Message);

        // Check Enum node
        let status = graph
            .nodes
            .iter()
            .find(|n| n.id == "user.v1.UserStatus")
            .expect("Enum node should exist");
        assert_eq!(status.node_type, NodeType::Enum);
        assert_eq!(status.label, "UserStatus");

        // Check edges (Service → Request, Service → User, User → UserStatus)
        assert_eq!(graph.edges.len(), 3);
        assert!(
            graph
                .edges
                .iter()
                .any(|e| e.source == "user.v1.UserService" && e.target == "user.v1.GetUserRequest")
        );
        assert!(
            graph
                .edges
                .iter()
                .any(|e| e.source == "user.v1.UserService" && e.target == "user.v1.User")
        );
        assert!(
            graph
                .edges
                .iter()
                .any(|e| e.source == "user.v1.User" && e.target == "user.v1.UserStatus")
        );
    }

    #[test]
    fn test_external_dependencies() {
        let fds = FileDescriptorSet {
            file: vec![
                FileDescriptorProto {
                    name: Some("google/protobuf/timestamp.proto".to_string()),
                    package: Some("google.protobuf".to_string()),
                    message_type: vec![DescriptorProto {
                        name: Some("Timestamp".to_string()),
                        ..Default::default()
                    }],
                    ..Default::default()
                },
                FileDescriptorProto {
                    name: Some("user/v1/user.proto".to_string()),
                    package: Some("user.v1".to_string()),
                    message_type: vec![DescriptorProto {
                        name: Some("User".to_string()),
                        field: vec![FieldDescriptorProto {
                            name: Some("created_at".to_string()),
                            number: Some(1),
                            r#type: Some(Type::Message as i32),
                            type_name: Some(".google.protobuf.Timestamp".to_string()),
                            ..Default::default()
                        }],
                        ..Default::default()
                    }],
                    ..Default::default()
                },
            ],
        };

        let mut analyzer = Analyzer::new();
        let graph = analyzer.analyze(&fds);

        // Should have 2 nodes: User + External Timestamp
        assert_eq!(graph.nodes.len(), 2);

        let user = graph
            .nodes
            .iter()
            .find(|n| n.id == "user.v1.User")
            .expect("User should exist");
        assert_eq!(user.node_type, NodeType::Message);

        let timestamp = graph
            .nodes
            .iter()
            .find(|n| n.id == "google.protobuf.Timestamp")
            .expect("External timestamp should exist");
        assert_eq!(timestamp.node_type, NodeType::External);

        // Edge from User to Timestamp
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "user.v1.User");
        assert_eq!(graph.edges[0].target, "google.protobuf.Timestamp");
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

    #[test]
    fn test_multiple_services_same_file() {
        let fds = FileDescriptorSet {
            file: vec![FileDescriptorProto {
                name: Some("api/v1/api.proto".to_string()),
                package: Some("api.v1".to_string()),
                service: vec![
                    ServiceDescriptorProto {
                        name: Some("UserService".to_string()),
                        ..Default::default()
                    },
                    ServiceDescriptorProto {
                        name: Some("OrderService".to_string()),
                        ..Default::default()
                    },
                ],
                ..Default::default()
            }],
        };

        let mut analyzer = Analyzer::new();
        let graph = analyzer.analyze(&fds);

        // Should have 2 Service nodes from the same file
        assert_eq!(graph.nodes.len(), 2);
        assert!(graph.nodes.iter().any(|n| n.id == "api.v1.UserService"));
        assert!(graph.nodes.iter().any(|n| n.id == "api.v1.OrderService"));
        assert!(
            graph
                .nodes
                .iter()
                .all(|n| n.file == "api/v1/api.proto" && n.node_type == NodeType::Service)
        );
    }
}
