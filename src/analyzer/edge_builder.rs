//! Edge creation logic for dependency relationships between protobuf definitions.

use std::collections::HashSet;

use crate::domain::Edge;

use super::Analyzer;

impl Analyzer {
    pub(crate) fn create_edges<'a>(
        &self,
        source: &str,
        references: impl Iterator<Item = &'a String>,
    ) -> Vec<Edge> {
        references
            .filter_map(|name| self.type_to_node_id.get(name))
            .map(|target| Edge::new(source.to_string(), target.clone()))
            .collect()
    }

    pub(crate) fn deduplicate_edges(edges: Vec<Edge>) -> Vec<Edge> {
        let mut seen = HashSet::new();
        edges
            .into_iter()
            .filter(|e| seen.insert((e.source.clone(), e.target.clone())))
            .collect()
    }
}
