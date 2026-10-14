//! Diff computation for comparing proto dependency graphs.
//!
//! Compares two GraphModels and generates a report showing added, modified, and removed items.

use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::domain::node::{EnumValue, FieldInfo, MethodSignature};
use crate::domain::{GraphModel, Node, NodeDetails, NodeType};

/// Represents changes between two GraphModel snapshots.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffReport {
    pub added: DiffItems,
    pub removed: DiffItems,
    pub modified: Vec<ModifiedItem>,
}

/// Collection of items by type (services, messages, enums).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiffItems {
    pub services: Vec<DiffNode>,
    pub messages: Vec<DiffNode>,
    pub enums: Vec<DiffNode>,
}

/// Simplified node representation for diff output.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffNode {
    pub id: String,
    pub label: String,
    pub package: String,
}

impl From<&Node> for DiffNode {
    fn from(node: &Node) -> Self {
        Self {
            id: node.id.clone(),
            label: node.label.clone(),
            package: node.package.clone(),
        }
    }
}

/// Represents a modified item with its changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifiedItem {
    pub node_id: String,
    pub label: String,
    pub node_type: NodeType,
    pub package: String,
    pub changes: Vec<Change>,
}

/// Individual change within a modified item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Change {
    FieldAdded { field: FieldInfo },
    FieldRemoved { field: FieldInfo },
    MethodAdded { method: MethodSignature },
    MethodRemoved { method: MethodSignature },
    EnumValueAdded { value: EnumValue },
    EnumValueRemoved { value: EnumValue },
}

impl DiffReport {
    /// Compute differences between base and head GraphModels.
    #[must_use]
    pub fn compute(base: &GraphModel, head: &GraphModel) -> Self {
        let base_nodes: HashMap<&str, &Node> =
            base.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
        let head_nodes: HashMap<&str, &Node> =
            head.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let base_ids: HashSet<&str> = base_nodes.keys().copied().collect();
        let head_ids: HashSet<&str> = head_nodes.keys().copied().collect();

        // Replacing a message with an enum/service at the same ID is a removal
        // plus addition, not an unchanged node or an unrepresentable modification.
        let added = Self::collect_diff_items(
            head_ids.iter().copied().filter(|id| {
                base_nodes
                    .get(id)
                    .is_none_or(|base| base.node_type != head_nodes[id].node_type)
            }),
            &head_nodes,
        );
        let removed = Self::collect_diff_items(
            base_ids.iter().copied().filter(|id| {
                head_nodes
                    .get(id)
                    .is_none_or(|head| head.node_type != base_nodes[id].node_type)
            }),
            &base_nodes,
        );

        let mut modified: Vec<ModifiedItem> = base_ids
            .intersection(&head_ids)
            .filter_map(|id| {
                let base_node = base_nodes.get(id)?;
                let head_node = head_nodes.get(id)?;
                if base_node.node_type != head_node.node_type {
                    return None;
                }
                Self::compute_node_changes(base_node, head_node)
            })
            .collect();

        modified.sort_by(|a, b| a.node_id.cmp(&b.node_id));

        Self {
            added,
            removed,
            modified,
        }
    }

    /// Check if there are any changes.
    #[must_use]
    pub fn has_changes(&self) -> bool {
        !self.added.is_empty() || !self.removed.is_empty() || !self.modified.is_empty()
    }

    fn collect_diff_items<'a>(
        ids: impl Iterator<Item = &'a str>,
        nodes: &HashMap<&str, &Node>,
    ) -> DiffItems {
        let mut items = DiffItems::default();

        for id in ids {
            if let Some(node) = nodes.get(id) {
                let diff_node = DiffNode::from(*node);
                match node.node_type {
                    NodeType::Service => items.services.push(diff_node),
                    NodeType::Message => items.messages.push(diff_node),
                    NodeType::Enum => items.enums.push(diff_node),
                    NodeType::External => {}
                }
            }
        }

        items.services.sort_by(|a, b| a.id.cmp(&b.id));
        items.messages.sort_by(|a, b| a.id.cmp(&b.id));
        items.enums.sort_by(|a, b| a.id.cmp(&b.id));

        items
    }

    fn compute_node_changes(base: &Node, head: &Node) -> Option<ModifiedItem> {
        let changes = match (&base.details, &head.details) {
            (
                NodeDetails::Service {
                    methods: base_methods,
                    ..
                },
                NodeDetails::Service {
                    methods: head_methods,
                    ..
                },
            ) => Self::compute_item_changes(
                base_methods,
                head_methods,
                |m| m.name.as_str(),
                |m| Change::MethodAdded { method: m },
                |m| Change::MethodRemoved { method: m },
                false,
            ),

            (
                NodeDetails::Message {
                    fields: base_fields,
                },
                NodeDetails::Message {
                    fields: head_fields,
                },
            ) => Self::compute_item_changes(
                base_fields,
                head_fields,
                |f| f.name.as_str(),
                |f| Change::FieldAdded { field: f },
                |f| Change::FieldRemoved { field: f },
                false,
            ),

            (
                NodeDetails::Enum {
                    values: base_values,
                },
                NodeDetails::Enum {
                    values: head_values,
                },
            ) => Self::compute_item_changes(
                base_values,
                head_values,
                |v| v.name.as_str(),
                |v| Change::EnumValueAdded { value: v },
                |v| Change::EnumValueRemoved { value: v },
                true, // Declaration order controls implicit defaults and alias precedence.
            ),

            _ => vec![],
        };

        if changes.is_empty() {
            None
        } else {
            Some(ModifiedItem {
                node_id: head.id.clone(),
                label: head.label.clone(),
                node_type: head.node_type.clone(),
                package: head.package.clone(),
                changes,
            })
        }
    }

    /// Generic diff computation for named items.
    fn compute_item_changes<T: Clone + PartialEq>(
        base_items: &[T],
        head_items: &[T],
        get_name: fn(&T) -> &str,
        make_added: fn(T) -> Change,
        make_removed: fn(T) -> Change,
        order_sensitive: bool,
    ) -> Vec<Change> {
        let base: BTreeMap<&str, (usize, &T)> = base_items
            .iter()
            .enumerate()
            .map(|(index, item)| (get_name(item), (index, item)))
            .collect();
        let head: BTreeMap<&str, (usize, &T)> = head_items
            .iter()
            .enumerate()
            .map(|(index, item)| (get_name(item), (index, item)))
            .collect();
        let mut changes = Vec::new();

        // A changed definition is a removal plus addition, preserving the report contract.
        for (name, (index, item)) in &base {
            if head.get(name).is_none_or(|(next_index, next)| {
                *next != *item || (order_sensitive && next_index != index)
            }) {
                changes.push(make_removed((*item).clone()));
            }
        }
        for (name, (index, item)) in &head {
            if base.get(name).is_none_or(|(previous_index, previous)| {
                *previous != *item || (order_sensitive && previous_index != index)
            }) {
                changes.push(make_added((*item).clone()));
            }
        }

        changes
    }
}

impl DiffItems {
    /// Check if there are no items.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.services.is_empty() && self.messages.is_empty() && self.enums.is_empty()
    }

    /// Get total count of all items.
    #[must_use]
    pub fn total_count(&self) -> usize {
        self.services.len() + self.messages.len() + self.enums.len()
    }
}
