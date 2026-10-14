//! Utility functions for the analyzer module.

use std::collections::BTreeMap;

use prost_types::DescriptorProto;
use prost_types::field_descriptor_proto::{Label, Type};

use crate::domain::{Node, Package};

/// Check if a file path belongs to an external dependency (google.*, buf.*).
pub(crate) fn is_external_file(file_path: &str) -> bool {
    file_path.starts_with("google/") || file_path.starts_with("buf/")
}

/// Generate node ID: `{package}.{name}` or just `{name}` if no package.
pub(crate) fn generate_node_id(package: &str, name: &str) -> String {
    if package.is_empty() {
        name.to_string()
    } else {
        format!("{package}.{name}")
    }
}

/// Generate fully-qualified type name for internal tracking: `.{package}.{name}`.
pub(crate) fn generate_fq_type(package: &str, name: &str) -> String {
    if package.is_empty() {
        format!(".{name}")
    } else {
        format!(".{package}.{name}")
    }
}

/// Visit nested messages without recursion or silent depth truncation.
pub(crate) fn scoped_messages(
    messages: &[DescriptorProto],
) -> impl Iterator<Item = (&DescriptorProto, String)> + '_ {
    let mut pending: Vec<_> = messages
        .iter()
        .rev()
        .map(|message| (message, String::new()))
        .collect();
    std::iter::from_fn(move || {
        while let Some((message, parent)) = pending.pop() {
            let Some(name) = message.name.as_deref() else {
                continue;
            };
            let scoped_name = generate_node_id(&parent, name);
            pending.extend(
                message
                    .nested_type
                    .iter()
                    .rev()
                    .map(|nested| (nested, scoped_name.clone())),
            );
            return Some((message, scoped_name));
        }
        None
    })
}

/// Keep local names concise, but retain scopes and foreign package identity.
pub(crate) fn display_type(full_type: Option<&String>, package: &str) -> String {
    let prefix = if package.is_empty() {
        ".".to_string()
    } else {
        format!(".{package}.")
    };
    full_type
        .map(|t| {
            // With no package, stripping the dot from a foreign type would make
            // it indistinguishable from a local nested name.
            if package.is_empty() && t.trim_start_matches('.').contains('.') {
                t.clone()
            } else {
                t.strip_prefix(prefix.as_str()).unwrap_or(t).to_string()
            }
        })
        .unwrap_or_default()
}

pub(crate) fn label_to_string(label: Option<i32>) -> String {
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

pub(crate) fn type_to_string(
    field_type: Option<i32>,
    type_name: Option<&String>,
    package: &str,
) -> String {
    if let Some(name) = type_name.filter(|n| !n.is_empty()) {
        return display_type(Some(name), package);
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

pub(crate) fn group_packages(nodes: &[Node]) -> Vec<Package> {
    let mut package_map: BTreeMap<String, Vec<String>> = BTreeMap::new();

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
