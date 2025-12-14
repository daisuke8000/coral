use serde::{Deserialize, Serialize};
use super::node::Node;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Package {
    pub id: String,
    pub node_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphModel {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
    pub packages: Vec<Package>,
}

impl GraphModel {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            edges: Vec::new(),
            packages: Vec::new(),
        }
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
        assert!(json.contains("\"source\":"));
        assert!(json.contains("\"target\":"));

        let restored: Edge = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.source, original.source);
        assert_eq!(restored.target, original.target);
    }

    #[test]
    fn test_package_roundtrip() {
        let original = Package {
            id: "user.v1".to_string(),
            node_ids: vec!["user.v1/A".to_string(), "user.v1/B".to_string()],
        };

        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"nodeIds\":")); // camelCase check

        let restored: Package = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.id, original.id);
        assert_eq!(restored.node_ids, original.node_ids);
    }

    #[test]
    fn test_graph_model_empty_and_default() {
        // new() and default() should produce identical empty graphs
        let from_new = GraphModel::new();
        let from_default = GraphModel::default();

        assert!(from_new.nodes.is_empty());
        assert!(from_new.edges.is_empty());
        assert!(from_new.packages.is_empty());

        let json_new = serde_json::to_string(&from_new).expect("serialize");
        let json_default = serde_json::to_string(&from_default).expect("serialize");
        assert_eq!(json_new, json_default);
        assert_eq!(json_new, r#"{"nodes":[],"edges":[],"packages":[]}"#);
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
                            field_type: "string".to_string(),
                        }],
                    },
                ),
            ],
            edges: vec![Edge {
                source: "user.v1/UserService".to_string(),
                target: "user.v1/User".to_string(),
            }],
            packages: vec![Package {
                id: "user.v1".to_string(),
                node_ids: vec!["user.v1/UserService".to_string(), "user.v1/User".to_string()],
            }],
        };

        // Serialize and verify structure
        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"nodes\":["));
        assert!(json.contains("\"edges\":["));
        assert!(json.contains("\"packages\":["));
        assert!(json.contains("\"type\":\"service\""));
        assert!(json.contains("\"type\":\"message\""));
        assert!(json.contains("\"nodeIds\":["));

        // Roundtrip verification
        let restored: GraphModel = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.nodes.len(), 2);
        assert_eq!(restored.edges.len(), 1);
        assert_eq!(restored.packages.len(), 1);
        assert_eq!(restored.nodes[0].id, "user.v1/UserService");
        assert_eq!(restored.edges[0].source, "user.v1/UserService");
        assert_eq!(restored.packages[0].id, "user.v1");

        // Pretty print check
        let pretty = serde_json::to_string_pretty(&original).expect("serialize");
        assert!(pretty.contains('\n'));
    }
}
