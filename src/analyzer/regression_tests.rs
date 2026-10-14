use std::collections::HashSet;

use prost_types::field_descriptor_proto::{Label, Type};
use prost_types::{
    DescriptorProto, EnumDescriptorProto, EnumValueDescriptorProto, FieldDescriptorProto,
    FileDescriptorProto, FileDescriptorSet, MethodDescriptorProto, ServiceDescriptorProto,
};

use crate::DiffReport;
use crate::domain::{GraphModel, NodeDetails, NodeType};

use super::Analyzer;

fn message(name: &str, references: &[&str]) -> DescriptorProto {
    DescriptorProto {
        name: Some(name.into()),
        field: references
            .iter()
            .enumerate()
            .map(|(i, ty)| FieldDescriptorProto {
                name: Some(format!("field_{i}")),
                number: Some(i as i32 + 1),
                type_name: Some((*ty).into()),
                r#type: Some(Type::Message as i32),
                label: Some(Label::Optional as i32),
                ..Default::default()
            })
            .collect(),
        ..Default::default()
    }
}

fn service(input: &str, output: &str) -> ServiceDescriptorProto {
    ServiceDescriptorProto {
        name: Some("Api".into()),
        method: vec![MethodDescriptorProto {
            name: Some("Call".into()),
            input_type: Some(input.into()),
            output_type: Some(output.into()),
            ..Default::default()
        }],
        ..Default::default()
    }
}

fn file(package: &str, messages: Vec<DescriptorProto>) -> FileDescriptorProto {
    FileDescriptorProto {
        name: Some(format!("{package}.proto")),
        package: Some(package.into()),
        syntax: Some("proto3".into()),
        message_type: messages,
        ..Default::default()
    }
}

fn assert_closed_graph(graph: &GraphModel) {
    let ids: HashSet<_> = graph.nodes.iter().map(|node| node.id.as_str()).collect();
    assert_eq!(ids.len(), graph.nodes.len(), "duplicate node IDs");
    for edge in &graph.edges {
        assert!(
            ids.contains(edge.source.as_str()),
            "missing source: {}",
            edge.source
        );
        assert!(
            ids.contains(edge.target.as_str()),
            "missing target: {}",
            edge.target
        );
    }
}

#[test]
fn nested_messages_enums_and_rpc_definitions_are_materialized() {
    let mut inner = message("Inner", &[".p.Outer.Inner.State", ".p.Outer"]);
    inner.field[0].r#type = Some(Type::Enum as i32);
    inner.enum_type.push(EnumDescriptorProto {
        name: Some("State".into()),
        value: vec![EnumValueDescriptorProto {
            name: Some("UNKNOWN".into()),
            number: Some(0),
            ..Default::default()
        }],
        ..Default::default()
    });
    let mut outer = message("Outer", &[".p.Outer.Inner"]);
    outer.nested_type.push(inner);
    let mut source = file("p", vec![outer]);
    source.service.push(service(".p.Outer.Inner", ".p.Outer"));
    let graph = Analyzer::new().analyze(&FileDescriptorSet { file: vec![source] });
    assert_closed_graph(&graph);
    assert_eq!(graph.nodes.len(), 4);
    assert_eq!(graph.edges.len(), 5);
    let nested = graph
        .nodes
        .iter()
        .find(|n| n.id == "p.Outer.Inner")
        .unwrap();
    assert_eq!(nested.label, "Outer.Inner");
    assert_eq!(nested.package, "p");
    let api = graph.nodes.iter().find(|n| n.id == "p.Api").unwrap();
    let NodeDetails::Service { methods, messages } = &api.details else {
        panic!()
    };
    assert_eq!(methods[0].input_type, "Outer.Inner");
    assert_eq!(messages[0].name, methods[0].input_type);
    assert_eq!(messages[0].fields.len(), 2);
    assert!(
        graph
            .nodes
            .iter()
            .any(|n| n.id == "p.Outer.Inner.State" && n.node_type == NodeType::Enum)
    );
}

#[test]
fn nested_registration_does_not_silently_stop_at_depth_32() {
    let mut nested = message("N", &[]);
    for _ in 0..40 {
        let mut parent = message("N", &[]);
        parent.nested_type.push(nested);
        nested = parent;
    }
    let graph = Analyzer::new().analyze(&FileDescriptorSet {
        file: vec![file("", vec![nested])],
    });
    assert_eq!(graph.nodes.len(), 41);
    assert!(graph.nodes.iter().any(|n| n.id == vec!["N"; 41].join(".")));
    assert_closed_graph(&graph);
}

#[test]
fn external_rpc_and_nested_references_use_descriptor_provenance() {
    // Externalness is based on file paths, not package-name guesses.
    let mut external = file("vendor", vec![message("Outer", &[])]);
    external.name = Some("google/vendor/types.proto".into());
    external.message_type[0]
        .nested_type
        .push(message("Inner", &[]));
    external.message_type[0]
        .enum_type
        .push(EnumDescriptorProto {
            name: Some("State".into()),
            value: vec![EnumValueDescriptorProto {
                name: Some("UNKNOWN".into()),
                number: Some(0),
                ..Default::default()
            }],
            ..Default::default()
        });
    external
        .service
        .push(service(".vendor.Outer", ".vendor.Outer"));
    let mut local = file("p", vec![message("Local", &[".vendor.Outer.State"])]);
    local.message_type[0].field[0].r#type = Some(Type::Enum as i32);
    local
        .service
        .push(service(".vendor.Outer.Inner", ".vendor.Outer.Inner"));
    let graph = Analyzer::new().analyze(&FileDescriptorSet {
        file: vec![local, external],
    });
    assert_closed_graph(&graph);
    assert_eq!(graph.nodes.len(), 4); // local message/service + only referenced externals
    assert_eq!(graph.edges.len(), 2); // repeated RPC references deduplicate
    for id in ["vendor.Outer.Inner", "vendor.Outer.State"] {
        let node = graph.nodes.iter().find(|n| n.id == id).unwrap();
        assert_eq!(node.node_type, NodeType::External);
        assert_eq!(node.package, "vendor");
        assert_eq!(node.file, "google/vendor/types.proto");
    }
    let api = graph.nodes.iter().find(|n| n.id == "p.Api").unwrap();
    let NodeDetails::Service { methods, messages } = &api.details else {
        panic!()
    };
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].name, methods[0].input_type);
}

#[test]
fn same_short_names_remain_distinct_in_service_and_field_diffs() {
    let mut local = file("p", vec![message("Holder", &[".a.Item"])]);
    local.service.push(service(".a.Item", ".b.Item"));
    let mut fds = FileDescriptorSet {
        file: vec![
            local,
            file("a", vec![message("Item", &[])]),
            file("b", vec![message("Item", &[".a.Item"])]),
        ],
    };
    let mut analyzer = Analyzer::new();
    let base = analyzer.analyze(&fds);
    let api = base.nodes.iter().find(|n| n.id == "p.Api").unwrap();
    let NodeDetails::Service { methods, messages } = &api.details else {
        panic!()
    };
    assert_ne!(methods[0].input_type, methods[0].output_type);
    assert_eq!(messages[0].name, methods[0].input_type);
    assert_eq!(messages[1].name, methods[0].output_type);
    assert_eq!(messages[0].fields.len(), 0);
    assert_eq!(messages[1].fields.len(), 1);
    fds.file[0].message_type[0].field[0].type_name = Some(".b.Item".into());
    fds.file[0].service[0].method[0].input_type = Some(".b.Item".into());
    let head = analyzer.analyze(&fds);
    let diff = DiffReport::compute(&base, &head);
    assert_eq!(diff.modified.len(), 2);
    assert!(diff.modified.iter().all(|item| item.changes.len() == 2));
    assert_closed_graph(&base);
    assert_closed_graph(&head);
}

#[test]
fn own_package_prefix_is_matched_at_a_segment_boundary() {
    let mut source = file("p", vec![message("Item", &[".prefix.Item", ".p.Item"])]);
    source.service.push(service(".p.Item", ".prefix.Item"));
    let graph = Analyzer::new().analyze(&FileDescriptorSet {
        file: vec![source, file("prefix", vec![message("Item", &[])])],
    });
    let api = graph.nodes.iter().find(|n| n.id == "p.Api").unwrap();
    let NodeDetails::Service { methods, messages } = &api.details else {
        panic!()
    };
    assert_eq!(methods[0].input_type, "Item"); // preserve local, top-level output
    assert_eq!(methods[0].output_type, ".prefix.Item");
    assert_eq!(messages[0].name, "Item");
    assert_closed_graph(&graph);
}

#[test]
fn packages_are_sorted_and_reuse_clears_rpc_and_external_definitions() {
    let mut old = file("z", vec![message("Gone", &[])]);
    old.name = Some("google/gone.proto".into());
    let mut analyzer = Analyzer::new();
    let _ = analyzer.analyze(&FileDescriptorSet { file: vec![old] });
    let mut source = file("a", vec![message("Current", &[])]);
    source.service.push(service(".z.Gone", ".z.Gone"));
    let graph = analyzer.analyze(&FileDescriptorSet {
        file: vec![file("z", vec![message("New", &[])]), source],
    });
    assert_eq!(
        graph
            .packages
            .iter()
            .map(|p| p.id.as_str())
            .collect::<Vec<_>>(),
        ["a", "z"]
    );
    let api = graph.nodes.iter().find(|n| n.id == "a.Api").unwrap();
    let NodeDetails::Service { messages, .. } = &api.details else {
        panic!()
    };
    assert!(messages.is_empty());
    assert!(graph.edges.is_empty());
    assert_closed_graph(&graph);
}

#[test]
fn map_entry_fields_contribute_dependencies_without_dangling_nodes() {
    let mut entry = message("ItemsEntry", &[".p.Value"]);
    entry.options = Some(prost_types::MessageOptions {
        map_entry: Some(true),
        ..Default::default()
    });
    entry.field[0].name = Some("value".into());
    entry.field[0].number = Some(2);
    entry.field[0].r#type = Some(Type::Message as i32);
    entry.field.insert(
        0,
        FieldDescriptorProto {
            name: Some("key".into()),
            number: Some(1),
            r#type: Some(Type::String as i32),
            label: Some(Label::Optional as i32),
            ..Default::default()
        },
    );
    let mut outer = message("Outer", &[".p.Outer.ItemsEntry"]);
    outer.field[0].name = Some("items".into());
    outer.field[0].label = Some(Label::Repeated as i32);
    outer.nested_type.push(entry);
    let graph = Analyzer::new().analyze(&FileDescriptorSet {
        file: vec![file("p", vec![outer, message("Value", &[])])],
    });
    assert_closed_graph(&graph);
    assert_eq!(graph.nodes.len(), 3);
    assert_eq!(graph.edges.len(), 2);
    assert!(
        graph
            .edges
            .iter()
            .any(|edge| edge.source == "p.Outer.ItemsEntry" && edge.target == "p.Value")
    );
}

#[test]
fn many_external_references_materialize_each_target_once() {
    let names: Vec<_> = (0..1024).map(|i| format!("Type{i}")).collect();
    let mut external = file(
        "vendor",
        names.iter().map(|name| message(name, &[])).collect(),
    );
    external.name = Some("buf/vendor/types.proto".into());
    let references: Vec<_> = names.iter().map(|name| format!(".vendor.{name}")).collect();
    let references: Vec<_> = references.iter().map(String::as_str).collect();
    let mut local = file("p", vec![message("Holder", &references)]);
    local
        .service
        .push(service(".vendor.Type0", ".vendor.Type0"));
    let graph = Analyzer::new().analyze(&FileDescriptorSet {
        file: vec![local, external],
    });
    assert_closed_graph(&graph);
    assert_eq!(graph.nodes.len(), 1026);
    assert_eq!(graph.edges.len(), 1025);
    assert_eq!(
        graph
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::External)
            .count(),
        1024
    );
}
