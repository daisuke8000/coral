use prost_types::field_descriptor_proto::Type;
use prost_types::{
    DescriptorProto, EnumDescriptorProto, EnumValueDescriptorProto, FieldDescriptorProto,
    FileDescriptorProto, FileDescriptorSet, MethodDescriptorProto, ServiceDescriptorProto,
};

use crate::domain::NodeType;

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

#[test]
fn analyzer_reuse_does_not_resolve_types_from_an_earlier_snapshot() {
    let mut analyzer = Analyzer::new();
    let _ = analyzer.analyze(&FileDescriptorSet {
        file: vec![FileDescriptorProto {
            name: Some("old.proto".into()),
            package: Some("old".into()),
            message_type: vec![DescriptorProto {
                name: Some("Gone".into()),
                ..Default::default()
            }],
            ..Default::default()
        }],
    });
    let graph = analyzer.analyze(&FileDescriptorSet {
        file: vec![FileDescriptorProto {
            name: Some("new.proto".into()),
            package: Some("new".into()),
            message_type: vec![DescriptorProto {
                name: Some("Current".into()),
                field: vec![FieldDescriptorProto {
                    name: Some("stale".into()),
                    type_name: Some(".old.Gone".into()),
                    ..Default::default()
                }],
                ..Default::default()
            }],
            ..Default::default()
        }],
    });
    assert_eq!(graph.nodes.len(), 1);
    assert!(graph.edges.is_empty());
}
