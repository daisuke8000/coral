//! Diff computation for comparing proto dependency graphs.
//!
//! Compares two GraphModels and generates a report showing added, modified, and removed items.

use std::collections::{HashMap, HashSet};

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
        // Build lookup maps by node ID
        let base_nodes: HashMap<&str, &Node> =
            base.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
        let head_nodes: HashMap<&str, &Node> =
            head.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        // Compute set differences
        let base_ids: HashSet<&str> = base_nodes.keys().copied().collect();
        let head_ids: HashSet<&str> = head_nodes.keys().copied().collect();

        // Added: in HEAD but not in BASE
        let added = Self::collect_diff_items(head_ids.difference(&base_ids).copied(), &head_nodes);

        // Removed: in BASE but not in HEAD
        let removed =
            Self::collect_diff_items(base_ids.difference(&head_ids).copied(), &base_nodes);

        // Modified: in both, check for changes
        let mut modified: Vec<ModifiedItem> = base_ids
            .intersection(&head_ids)
            .filter_map(|id| {
                let base_node = base_nodes.get(id)?;
                let head_node = head_nodes.get(id)?;
                Self::compute_node_changes(base_node, head_node)
            })
            .collect();

        // Sort for deterministic output
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

    /// Generate Markdown representation of the diff.
    #[must_use]
    pub fn to_markdown(&self) -> String {
        if !self.has_changes() {
            return "### No Changes Detected\n\n".to_string();
        }

        let mut output = String::from("### Changes from Base\n\n");

        // Added section
        if !self.added.is_empty() {
            output.push_str(&format!("#### ✅ Added (+{})\n", self.added.total_count()));
            output.push_str("| Type | Name | Package |\n");
            output.push_str("|------|------|--------|\n");

            for svc in &self.added.services {
                output.push_str(&format!("| Service | {} | {} |\n", svc.label, svc.package));
            }
            for msg in &self.added.messages {
                output.push_str(&format!("| Message | {} | {} |\n", msg.label, msg.package));
            }
            for enm in &self.added.enums {
                output.push_str(&format!("| Enum | {} | {} |\n", enm.label, enm.package));
            }
            output.push('\n');
        }

        // Modified section
        if !self.modified.is_empty() {
            output.push_str(&format!("#### ⚠️ Modified ({})\n", self.modified.len()));
            output.push_str("| Type | Name | Changes |\n");
            output.push_str("|------|------|--------|\n");

            for item in &self.modified {
                let type_str = match item.node_type {
                    NodeType::Service => "Service",
                    NodeType::Message => "Message",
                    NodeType::Enum => "Enum",
                    NodeType::External => "External",
                };
                let changes_summary = Self::summarize_changes(&item.changes);
                output.push_str(&format!(
                    "| {} | {} | {} |\n",
                    type_str, item.label, changes_summary
                ));
            }
            output.push('\n');
        }

        // Removed section
        if !self.removed.is_empty() {
            output.push_str(&format!(
                "#### ❌ Removed (-{})\n",
                self.removed.total_count()
            ));
            output.push_str("| Type | Name | Package |\n");
            output.push_str("|------|------|--------|\n");

            for svc in &self.removed.services {
                output.push_str(&format!("| Service | {} | {} |\n", svc.label, svc.package));
            }
            for msg in &self.removed.messages {
                output.push_str(&format!("| Message | {} | {} |\n", msg.label, msg.package));
            }
            for enm in &self.removed.enums {
                output.push_str(&format!("| Enum | {} | {} |\n", enm.label, enm.package));
            }
            output.push('\n');
        }

        output
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

        // Sort for deterministic output (HashSet iteration order is non-deterministic)
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
            ) => Self::compute_method_changes(base_methods, head_methods),

            (
                NodeDetails::Message {
                    fields: base_fields,
                },
                NodeDetails::Message {
                    fields: head_fields,
                },
            ) => Self::compute_field_changes(base_fields, head_fields),

            (
                NodeDetails::Enum {
                    values: base_values,
                },
                NodeDetails::Enum {
                    values: head_values,
                },
            ) => Self::compute_enum_changes(base_values, head_values),

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

    fn compute_method_changes(
        base_methods: &[MethodSignature],
        head_methods: &[MethodSignature],
    ) -> Vec<Change> {
        let mut changes = vec![];

        let base_set: HashSet<&str> = base_methods.iter().map(|m| m.name.as_str()).collect();
        let head_set: HashSet<&str> = head_methods.iter().map(|m| m.name.as_str()).collect();

        // Added methods
        for name in head_set.difference(&base_set) {
            if let Some(method) = head_methods.iter().find(|m| m.name == *name) {
                changes.push(Change::MethodAdded {
                    method: method.clone(),
                });
            }
        }

        // Removed methods
        for name in base_set.difference(&head_set) {
            if let Some(method) = base_methods.iter().find(|m| m.name == *name) {
                changes.push(Change::MethodRemoved {
                    method: method.clone(),
                });
            }
        }

        changes
    }

    fn compute_field_changes(base_fields: &[FieldInfo], head_fields: &[FieldInfo]) -> Vec<Change> {
        let mut changes = vec![];

        let base_set: HashSet<&str> = base_fields.iter().map(|f| f.name.as_str()).collect();
        let head_set: HashSet<&str> = head_fields.iter().map(|f| f.name.as_str()).collect();

        // Added fields
        for name in head_set.difference(&base_set) {
            if let Some(field) = head_fields.iter().find(|f| f.name == *name) {
                changes.push(Change::FieldAdded {
                    field: field.clone(),
                });
            }
        }

        // Removed fields
        for name in base_set.difference(&head_set) {
            if let Some(field) = base_fields.iter().find(|f| f.name == *name) {
                changes.push(Change::FieldRemoved {
                    field: field.clone(),
                });
            }
        }

        changes
    }

    fn compute_enum_changes(base_values: &[EnumValue], head_values: &[EnumValue]) -> Vec<Change> {
        let mut changes = vec![];

        let base_set: HashSet<&str> = base_values.iter().map(|v| v.name.as_str()).collect();
        let head_set: HashSet<&str> = head_values.iter().map(|v| v.name.as_str()).collect();

        // Added values
        for name in head_set.difference(&base_set) {
            if let Some(value) = head_values.iter().find(|v| v.name == *name) {
                changes.push(Change::EnumValueAdded {
                    value: value.clone(),
                });
            }
        }

        // Removed values
        for name in base_set.difference(&head_set) {
            if let Some(value) = base_values.iter().find(|v| v.name == *name) {
                changes.push(Change::EnumValueRemoved {
                    value: value.clone(),
                });
            }
        }

        changes
    }

    fn summarize_changes(changes: &[Change]) -> String {
        let mut added_fields = 0;
        let mut removed_fields = 0;
        let mut added_methods = 0;
        let mut removed_methods = 0;
        let mut added_values = 0;
        let mut removed_values = 0;

        for change in changes {
            match change {
                Change::FieldAdded { .. } => added_fields += 1,
                Change::FieldRemoved { .. } => removed_fields += 1,
                Change::MethodAdded { .. } => added_methods += 1,
                Change::MethodRemoved { .. } => removed_methods += 1,
                Change::EnumValueAdded { .. } => added_values += 1,
                Change::EnumValueRemoved { .. } => removed_values += 1,
            }
        }

        let mut parts = vec![];

        if added_fields > 0 {
            parts.push(format!("+{} field(s)", added_fields));
        }
        if removed_fields > 0 {
            parts.push(format!("-{} field(s)", removed_fields));
        }
        if added_methods > 0 {
            parts.push(format!("+{} method(s)", added_methods));
        }
        if removed_methods > 0 {
            parts.push(format!("-{} method(s)", removed_methods));
        }
        if added_values > 0 {
            parts.push(format!("+{} value(s)", added_values));
        }
        if removed_values > 0 {
            parts.push(format!("-{} value(s)", removed_values));
        }

        parts.join(", ")
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

#[cfg(test)]
mod tests {
    use super::*;

    fn create_base_model() -> GraphModel {
        GraphModel {
            nodes: vec![
                Node::new(
                    "user.v1.UserService".to_string(),
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
                        messages: vec![],
                    },
                ),
                Node::new(
                    "user.v1.User".to_string(),
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
                    },
                ),
                Node::new(
                    "user.v1.OldMessage".to_string(),
                    NodeType::Message,
                    "user.v1".to_string(),
                    "OldMessage".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Message { fields: vec![] },
                ),
            ],
            edges: vec![],
            packages: vec![],
        }
    }

    fn create_head_model() -> GraphModel {
        GraphModel {
            nodes: vec![
                Node::new(
                    "user.v1.UserService".to_string(),
                    NodeType::Service,
                    "user.v1".to_string(),
                    "UserService".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Service {
                        methods: vec![
                            MethodSignature {
                                name: "GetUser".to_string(),
                                input_type: "GetUserRequest".to_string(),
                                output_type: "User".to_string(),
                            },
                            MethodSignature {
                                name: "CreateUser".to_string(),
                                input_type: "CreateUserRequest".to_string(),
                                output_type: "User".to_string(),
                            },
                        ],
                        messages: vec![],
                    },
                ),
                Node::new(
                    "user.v1.User".to_string(),
                    NodeType::Message,
                    "user.v1".to_string(),
                    "User".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Message {
                        fields: vec![
                            FieldInfo {
                                name: "id".to_string(),
                                number: 1,
                                type_name: "string".to_string(),
                                label: "optional".to_string(),
                            },
                            FieldInfo {
                                name: "email".to_string(),
                                number: 2,
                                type_name: "string".to_string(),
                                label: "optional".to_string(),
                            },
                        ],
                    },
                ),
                Node::new(
                    "user.v1.NewMessage".to_string(),
                    NodeType::Message,
                    "user.v1".to_string(),
                    "NewMessage".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Message { fields: vec![] },
                ),
            ],
            edges: vec![],
            packages: vec![],
        }
    }

    #[test]
    fn test_no_changes() {
        let model = create_base_model();
        let diff = DiffReport::compute(&model, &model);
        assert!(!diff.has_changes());
    }

    #[test]
    fn test_added_detection() {
        let base = create_base_model();
        let head = create_head_model();
        let diff = DiffReport::compute(&base, &head);

        assert_eq!(diff.added.messages.len(), 1);
        assert_eq!(diff.added.messages[0].label, "NewMessage");
    }

    #[test]
    fn test_removed_detection() {
        let base = create_base_model();
        let head = create_head_model();
        let diff = DiffReport::compute(&base, &head);

        assert_eq!(diff.removed.messages.len(), 1);
        assert_eq!(diff.removed.messages[0].label, "OldMessage");
    }

    #[test]
    fn test_modified_detection() {
        let base = create_base_model();
        let head = create_head_model();
        let diff = DiffReport::compute(&base, &head);

        assert_eq!(diff.modified.len(), 2); // UserService and User

        let service_mod = diff
            .modified
            .iter()
            .find(|m| m.label == "UserService")
            .expect("UserService should be modified");
        assert!(
            service_mod.changes.iter().any(
                |c| matches!(c, Change::MethodAdded { method } if method.name == "CreateUser")
            )
        );

        let user_mod = diff
            .modified
            .iter()
            .find(|m| m.label == "User")
            .expect("User should be modified");
        assert!(
            user_mod
                .changes
                .iter()
                .any(|c| matches!(c, Change::FieldAdded { field } if field.name == "email"))
        );
    }

    #[test]
    fn test_to_markdown_no_changes() {
        let model = create_base_model();
        let diff = DiffReport::compute(&model, &model);
        let markdown = diff.to_markdown();
        assert!(markdown.contains("No Changes Detected"));
    }

    #[test]
    fn test_to_markdown_with_changes() {
        let base = create_base_model();
        let head = create_head_model();
        let diff = DiffReport::compute(&base, &head);
        let markdown = diff.to_markdown();

        assert!(markdown.contains("### Changes from Base"));
        assert!(markdown.contains("✅ Added"));
        assert!(markdown.contains("⚠️ Modified"));
        assert!(markdown.contains("❌ Removed"));
        assert!(markdown.contains("NewMessage"));
        assert!(markdown.contains("OldMessage"));
    }

    #[test]
    fn test_diff_items_is_empty() {
        let items = DiffItems::default();
        assert!(items.is_empty());
        assert_eq!(items.total_count(), 0);
    }
}
