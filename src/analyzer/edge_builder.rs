//! Edge creation logic for dependency relationships between protobuf definitions.

use std::collections::HashSet;

use crate::domain::Edge;

use super::Analyzer;
use super::util;

impl Analyzer {
    pub(crate) fn create_service_edges(
        &self,
        service: &prost_types::ServiceDescriptorProto,
        package: &str,
    ) -> Vec<Edge> {
        let service_name = match &service.name {
            Some(n) => n,
            None => return Vec::new(),
        };
        let source_id = util::generate_node_id(package, service_name);

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

    pub(crate) fn create_message_edges(
        &self,
        message: &prost_types::DescriptorProto,
        package: &str,
        name: &str,
    ) -> Vec<Edge> {
        let source_id = util::generate_node_id(package, name);

        let mut edges = Vec::new();
        for field in &message.field {
            if let Some(type_name) = &field.type_name
                && let Some(target_id) = self.type_to_node_id.get(type_name)
            {
                edges.push(Edge::new(source_id.clone(), target_id.clone()));
            }
        }
        edges
    }

    pub(crate) fn deduplicate_edges(edges: Vec<Edge>) -> Vec<Edge> {
        let mut seen = HashSet::new();
        edges
            .into_iter()
            .filter(|e| seen.insert((e.source.clone(), e.target.clone())))
            .collect()
    }
}
