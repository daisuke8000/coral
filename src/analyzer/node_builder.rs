//! Node creation logic for protobuf descriptors.

use std::collections::HashSet;

use crate::domain::{
    EnumValue, FieldInfo, MessageDef, MethodSignature, Node, NodeDetails, NodeType,
};

use super::Analyzer;
use super::util;

impl Analyzer {
    pub(crate) fn create_service_node(
        &self,
        service: &prost_types::ServiceDescriptorProto,
        package: &str,
        file_name: &str,
    ) -> Option<Node> {
        let name = service.name.as_ref()?;
        let id = util::generate_node_id(package, name);

        let methods: Vec<MethodSignature> = service
            .method
            .iter()
            .map(|m| MethodSignature {
                name: m.name.clone().unwrap_or_default(),
                input_type: util::display_type(m.input_type.as_ref(), package),
                output_type: util::display_type(m.output_type.as_ref(), package),
            })
            .collect();

        // Definitions use the same names as their RPC references, so lookups
        // cannot select a different package's same-short-name message.
        let mut seen_types = HashSet::new();
        let mut messages = Vec::new();
        for method in &service.method {
            for type_name in [&method.input_type, &method.output_type]
                .into_iter()
                .flatten()
            {
                if seen_types.insert(type_name)
                    && let Some(msg_def) = self.type_to_message_def.get(type_name)
                {
                    let mut definition = msg_def.clone();
                    definition.name = util::display_type(Some(type_name), package);
                    messages.push(definition);
                }
            }
        }

        Some(Node::new(
            id,
            NodeType::Service,
            package.to_string(),
            name.clone(),
            file_name.to_string(),
            NodeDetails::Service { methods, messages },
        ))
    }

    pub(crate) fn create_message_node(
        &mut self,
        message: &prost_types::DescriptorProto,
        package: &str,
        file_name: &str,
        name: &str,
    ) -> Option<Node> {
        message.name.as_ref()?;
        let id = util::generate_node_id(package, name);
        let fq_type = util::generate_fq_type(package, name);
        self.type_to_node_id.insert(fq_type.clone(), id.clone());

        let fields: Vec<FieldInfo> = message
            .field
            .iter()
            .map(|f| FieldInfo {
                name: f.name.clone().unwrap_or_default(),
                number: f.number.unwrap_or(0),
                type_name: util::type_to_string(f.r#type, f.type_name.as_ref(), package),
                label: util::label_to_string(f.label),
            })
            .collect();

        self.type_to_message_def.insert(
            fq_type,
            MessageDef {
                name: name.to_string(),
                fields: fields.clone(),
            },
        );

        Some(Node::new(
            id,
            NodeType::Message,
            package.to_string(),
            name.to_string(),
            file_name.to_string(),
            NodeDetails::Message { fields },
        ))
    }

    pub(crate) fn create_enum_node(
        &mut self,
        enum_type: &prost_types::EnumDescriptorProto,
        package: &str,
        file_name: &str,
        parent: &str,
    ) -> Option<Node> {
        let name = util::generate_node_id(parent, enum_type.name.as_deref()?);
        let id = util::generate_node_id(package, &name);
        let fq_type = util::generate_fq_type(package, &name);
        self.type_to_node_id.insert(fq_type, id.clone());

        let values = enum_type
            .value
            .iter()
            .map(|v| EnumValue {
                name: v.name.clone().unwrap_or_default(),
                number: v.number.unwrap_or(0),
            })
            .collect();

        Some(Node::new(
            id,
            NodeType::Enum,
            package.to_string(),
            name,
            file_name.to_string(),
            NodeDetails::Enum { values },
        ))
    }
}
