//! Core Analyzer: orchestrates FileDescriptorSet → GraphModel conversion.

use std::collections::{HashMap, HashSet};

use prost_types::FileDescriptorSet;

use crate::domain::{GraphModel, MessageDef};

use super::util;

/// Analyzer creates definition-level nodes (Service, Message, Enum) from protobuf descriptors.
/// Each Service, Message, and Enum definition becomes its own graph node.
/// Edges are created based on field type references between definitions.
pub struct Analyzer {
    /// Maps fully-qualified type name to node ID (e.g., ".user.v1.User" → "user.v1.User")
    pub(super) type_to_node_id: HashMap<String, String>,
    /// Maps fully-qualified type name to MessageDef for expandable RPC method fields
    pub(super) type_to_message_def: HashMap<String, MessageDef>,
    /// Tracks external packages (google.*, buf.*) for External node creation
    pub(super) external_packages: HashSet<String>,
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
        self.type_to_node_id.clear();
        self.type_to_message_def.clear();
        self.external_packages.clear();
        let mut model = GraphModel::default();

        // First pass: Create Message/Enum nodes and build type mappings
        // (Service nodes need message definitions, so messages must be processed first)
        for file in &fds.file {
            let file_name = file.name.as_deref().unwrap_or("");
            let package = file.package.as_deref().unwrap_or("");
            let is_external = util::is_external_file(file_name);

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
            if util::is_external_file(file_name) {
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

        model.packages = util::group_packages(&model.nodes);
        model
    }
}

impl Default for Analyzer {
    fn default() -> Self {
        Self::new()
    }
}
