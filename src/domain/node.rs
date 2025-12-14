//! Node types for the proto dependency graph.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeType {
    Service,
    Message,
    External,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodSignature {
    pub name: String,
    pub input_type: String,
    pub output_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldInfo {
    pub name: String,
    pub number: i32,
    pub type_name: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumValue {
    pub name: String,
    pub number: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumInfo {
    pub name: String,
    pub values: Vec<EnumValue>,
}

/// Message definition with its fields (for Service nodes).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDef {
    pub name: String,
    pub fields: Vec<FieldInfo>,
}

/// Uses `#[serde(tag = "kind")]` for TypeScript discriminated unions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum NodeDetails {
    Service {
        methods: Vec<MethodSignature>,
        messages: Vec<MessageDef>,
    },
    Message {
        fields: Vec<FieldInfo>,
        enums: Vec<EnumInfo>,
    },
    External,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub package: String,
    pub label: String,
    pub file: String,
    pub details: NodeDetails,
}

impl Node {
    #[must_use]
    pub fn new(
        id: String,
        node_type: NodeType,
        package: String,
        label: String,
        file: String,
        details: NodeDetails,
    ) -> Self {
        Self {
            id,
            node_type,
            package,
            label,
            file,
            details,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_type_roundtrip() {
        let cases = [
            (NodeType::Service, "\"service\""),
            (NodeType::Message, "\"message\""),
            (NodeType::External, "\"external\""),
        ];

        for (variant, expected_json) in cases {
            let json = serde_json::to_string(&variant).expect("serialize");
            assert_eq!(json, expected_json);

            let restored: NodeType = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(restored, variant);
        }
    }

    #[test]
    fn test_method_signature_roundtrip() {
        let original = MethodSignature {
            name: "GetUser".to_string(),
            input_type: "GetUserRequest".to_string(),
            output_type: "GetUserResponse".to_string(),
        };

        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"inputType\":")); // camelCase check

        let restored: MethodSignature = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.name, original.name);
        assert_eq!(restored.input_type, original.input_type);
        assert_eq!(restored.output_type, original.output_type);
    }

    #[test]
    fn test_field_info_roundtrip() {
        let original = FieldInfo {
            name: "user_id".to_string(),
            number: 1,
            type_name: "string".to_string(),
            label: "optional".to_string(),
        };

        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"typeName\":")); // camelCase check
        assert!(json.contains("\"number\":"));

        let restored: FieldInfo = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.name, original.name);
        assert_eq!(restored.number, original.number);
        assert_eq!(restored.type_name, original.type_name);
        assert_eq!(restored.label, original.label);
    }

    #[test]
    fn test_enum_info_roundtrip() {
        let original = EnumInfo {
            name: "Status".to_string(),
            values: vec![
                EnumValue {
                    name: "UNKNOWN".to_string(),
                    number: 0,
                },
                EnumValue {
                    name: "ACTIVE".to_string(),
                    number: 1,
                },
            ],
        };

        let json = serde_json::to_string(&original).expect("serialize");
        assert!(json.contains("\"values\":["));

        let restored: EnumInfo = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(restored.name, original.name);
        assert_eq!(restored.values.len(), 2);
        assert_eq!(restored.values[0].name, "UNKNOWN");
        assert_eq!(restored.values[1].number, 1);
    }

    #[test]
    fn test_node_details_all_variants() {
        let service = NodeDetails::Service {
            methods: vec![MethodSignature {
                name: "Get".to_string(),
                input_type: "Req".to_string(),
                output_type: "Res".to_string(),
            }],
            messages: vec![MessageDef {
                name: "Req".to_string(),
                fields: vec![FieldInfo {
                    name: "id".to_string(),
                    number: 1,
                    type_name: "string".to_string(),
                    label: "optional".to_string(),
                }],
            }],
        };
        let json = serde_json::to_string(&service).expect("serialize");
        assert!(json.contains("\"kind\":\"Service\""));
        assert!(json.contains("\"methods\":["));
        assert!(json.contains("\"messages\":["));

        let message = NodeDetails::Message {
            fields: vec![FieldInfo {
                name: "id".to_string(),
                number: 1,
                type_name: "string".to_string(),
                label: "optional".to_string(),
            }],
            enums: vec![EnumInfo {
                name: "Status".to_string(),
                values: vec![EnumValue {
                    name: "UNKNOWN".to_string(),
                    number: 0,
                }],
            }],
        };
        let json = serde_json::to_string(&message).expect("serialize");
        assert!(json.contains("\"kind\":\"Message\""));
        assert!(json.contains("\"fields\":["));
        assert!(json.contains("\"enums\":["));

        let external = NodeDetails::External;
        let json = serde_json::to_string(&external).expect("serialize");
        assert!(json.contains("\"kind\":\"External\""));
    }

    #[test]
    fn test_node_all_types_roundtrip() {
        let nodes = vec![
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
                    messages: vec![MessageDef {
                        name: "GetUserRequest".to_string(),
                        fields: vec![FieldInfo {
                            name: "user_id".to_string(),
                            number: 1,
                            type_name: "string".to_string(),
                            label: "optional".to_string(),
                        }],
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
            Node::new(
                "google.protobuf/Timestamp".to_string(),
                NodeType::External,
                "google.protobuf".to_string(),
                "Timestamp".to_string(),
                "google/protobuf/timestamp.proto".to_string(),
                NodeDetails::External,
            ),
        ];

        for original in nodes {
            let json = serde_json::to_string(&original).expect("serialize");

            assert!(json.contains("\"type\":"));
            assert!(json.contains("\"id\":"));
            assert!(json.contains("\"package\":"));
            assert!(json.contains("\"label\":"));
            assert!(json.contains("\"file\":"));
            assert!(json.contains("\"details\":"));
            assert!(json.contains("\"kind\":"));

            let restored: Node = serde_json::from_str(&json).expect("deserialize");
            assert_eq!(restored.id, original.id);
            assert_eq!(restored.node_type, original.node_type);
            assert_eq!(restored.package, original.package);
            assert_eq!(restored.label, original.label);
            assert_eq!(restored.file, original.file);
        }
    }
}
