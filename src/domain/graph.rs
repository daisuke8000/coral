//! Graph model types for the proto dependency graph.

use super::node::Node;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
}

impl Edge {
    #[must_use]
    pub fn new(source: String, target: String) -> Self {
        Self { source, target }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub id: String,
    pub node_ids: Vec<String>,
}

impl Package {
    #[must_use]
    pub fn new(id: String, node_ids: Vec<String>) -> Self {
        Self { id, node_ids }
    }
}

/// Primary output of the analyzer, used as data source for React Flow.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphModel {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub packages: Vec<Package>,
}

impl GraphModel {
    #[must_use]
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            edges: Vec::new(),
            packages: Vec::new(),
        }
    }

    #[must_use]
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    #[must_use]
    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }

    #[must_use]
    pub fn find_node(&self, id: &str) -> Option<&Node> {
        self.nodes.iter().find(|n| n.id == id)
    }
}

impl Default for GraphModel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::node::{FieldInfo, MethodSignature, Node, NodeDetails, NodeType};

    #[test]
    fn test_edge_roundtrip() {
        let original = Edge {
            source: "user.v1/UserService".to_string(),
            target: "user.v1/User".to_string(),
        };

        let json = serde_json::to_string(&original).expect("serialize");
        let restored: Edge = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored, original);
    }

    #[test]
    fn test_package_roundtrip() {
        let original = Package {
            id: "user.v1".to_string(),
            node_ids: vec!["user.v1/A".to_string(), "user.v1/B".to_string()],
        };

        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"nodeIds\":")); // camelCase

        let restored: Package = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored, original);
    }

    #[test]
    fn test_graph_model_empty_and_default() {
        let from_new = GraphModel::new();
        let from_default = GraphModel::default();

        assert_eq!(from_new, from_default);
        assert_eq!(
            serde_json::to_string(&from_new).unwrap(),
            r#"{"nodes":[],"edges":[],"packages":[]}"#
        );
    }

    #[test]
    fn test_graph_model_full_roundtrip() {
        let original = GraphModel {
            nodes: vec![
                Node::new(
                    "user.v1/UserService".to_string(),
                    NodeType::Service,
                    "user.v1".to_string(),
                    "UserService".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Service {
                        methods: vec![MethodSignature {
                            name: "GetUser".to_string(),
                            input_type: "GetUserRequest".to_string(),
                            output_type: "User".to_string(),
                        }],
                    },
                ),
                Node::new(
                    "user.v1/User".to_string(),
                    NodeType::Message,
                    "user.v1".to_string(),
                    "User".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Message {
                        fields: vec![FieldInfo {
                            name: "id".to_string(),
                            number: 1,
                            type_name: "string".to_string(),
                            label: "optional".to_string(),
                        }],
                        enums: vec![],
                    },
                ),
            ],
            edges: vec![Edge {
                source: "user.v1/UserService".to_string(),
                target: "user.v1/User".to_string(),
            }],
            packages: vec![Package {
                id: "user.v1".to_string(),
                node_ids: vec![
                    "user.v1/UserService".to_string(),
                    "user.v1/User".to_string(),
                ],
            }],
        };

        let json = serde_json::to_string(&original).expect("serialize");
        let restored: GraphModel = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.nodes.len(), 2);
        assert_eq!(restored.edges.len(), 1);
        assert_eq!(restored.packages.len(), 1);
    }
}
