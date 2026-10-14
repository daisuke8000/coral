//! Core Analyzer: orchestrates FileDescriptorSet → GraphModel conversion.

use std::collections::HashMap;

use prost_types::FileDescriptorSet;

use crate::domain::{GraphModel, MessageDef, Node, NodeDetails, NodeType};

use super::util;

/// Analyzer creates definition-level nodes (Service, Message, Enum) from protobuf descriptors.
/// Each Service, Message, and Enum definition becomes its own graph node.
/// Edges are created based on field type references between definitions.
#[derive(Default)]
pub struct Analyzer {
    /// Maps fully-qualified type name to node ID (e.g., ".user.v1.User" → "user.v1.User")
    pub(super) type_to_node_id: HashMap<String, String>,
    /// Maps fully-qualified type name to MessageDef for expandable RPC method fields
    pub(super) type_to_message_def: HashMap<String, MessageDef>,
    /// External definitions, materialized only when referenced by an edge.
    pub(super) external_nodes: HashMap<String, Node>,
}

impl Analyzer {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn analyze(&mut self, fds: &FileDescriptorSet) -> GraphModel {
        self.type_to_node_id.clear();
        self.type_to_message_def.clear();
        self.external_nodes.clear();
        let mut model = GraphModel::default();

        // First pass: Create Message/Enum nodes and build type mappings
        // (Service nodes need message definitions, so messages must be processed first)
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            let package = file.package.as_deref().unwrap_or("");
            let is_external = util::is_external_file(file_name);

            // Every registered nested type also gets a definition node.
            for (message, scoped_name) in util::scoped_messages(&file.message_type) {
                if let Some(node) =
                    self.create_message_node(message, package, file_name, &scoped_name)
                {
                    self.add_definition(node, is_external, &mut model);
                }
                for enum_type in &message.enum_type {
                    if let Some(node) =
                        self.create_enum_node(enum_type, package, file_name, &scoped_name)
                    {
                        self.add_definition(node, is_external, &mut model);
                    }
                }
            }

            for enum_type in &file.enum_type {
                if let Some(node) = self.create_enum_node(enum_type, package, file_name, "") {
                    self.add_definition(node, is_external, &mut model);
                }
            }
        }

        // Second pass: definitions are indexed, so services and all references can resolve.
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            if util::is_external_file(file_name) {
                continue;
            }
            let package = file.package.as_deref().unwrap_or("");

            for service in &file.service {
                if let Some(node) = self.create_service_node(service, package, file_name) {
                    let references = service.method.iter().flat_map(|method| {
                        [method.input_type.as_ref(), method.output_type.as_ref()]
                    });
                    model
                        .edges
                        .extend(self.create_edges(&node.id, references.flatten()));
                    model.nodes.push(node);
                }
            }

            // Use the same scoped traversal for nested field dependencies.
            for (message, scoped_name) in util::scoped_messages(&file.message_type) {
                model.edges.extend(
                    self.create_edges(
                        &util::generate_node_id(package, &scoped_name),
                        message
                            .field
                            .iter()
                            .filter_map(|field| field.type_name.as_ref()),
                    ),
                );
            }
        }

        // Deduplicate edges
        model.edges = Self::deduplicate_edges(model.edges);

        // Hash lookups avoid a node-vector scan for every external reference,
        // including RPC-only references. Removal ensures one node per type.
        for edge in &model.edges {
            if let Some(node) = self.external_nodes.remove(&edge.target) {
                model.nodes.push(node);
            }
        }

        model.packages = util::group_packages(&model.nodes);
        model
    }

    fn add_definition(&mut self, mut node: Node, is_external: bool, model: &mut GraphModel) {
        if is_external {
            node.node_type = NodeType::External;
            node.details = NodeDetails::External;
            self.external_nodes.insert(node.id.clone(), node);
        } else {
            model.nodes.push(node);
        }
    }
}
