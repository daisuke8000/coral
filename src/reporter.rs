//! Markdown report generation for proto dependency analysis.
//!
//! Generates detailed Markdown output from GraphModel for PR comments.

use crate::domain::{GraphModel, Node, NodeDetails, NodeType};

/// Generates Markdown reports from proto dependency graphs.
pub struct MarkdownReporter;

impl MarkdownReporter {
    /// Generate complete Markdown report from GraphModel.
    #[must_use]
    pub fn generate(model: &GraphModel) -> String {
        let mut output = String::new();
        output.push_str(&Self::render_header());
        output.push_str(&Self::render_overview(model));
        output.push_str(&Self::render_services_section(model));
        output.push_str(&Self::render_messages_section(model));
        output.push_str(&Self::render_enums_section(model));
        output.push_str(&Self::render_footer());
        output
    }

    fn render_header() -> String {
        "## 🪸 Coral Proto Dependency Analysis\n\n".to_string()
    }

    fn render_overview(model: &GraphModel) -> String {
        let mut services = 0;
        let mut messages = 0;
        let mut enums = 0;
        let mut externals = 0;
        let mut files = std::collections::HashSet::new();

        for node in &model.nodes {
            match node.node_type {
                NodeType::Service => services += 1,
                NodeType::Message => messages += 1,
                NodeType::Enum => enums += 1,
                NodeType::External => externals += 1,
            }
            files.insert(&node.file);
        }

        format!(
            "### Overview\n\
             | Metric | Count |\n\
             |--------|-------|\n\
             | Files | {} |\n\
             | Services | {} |\n\
             | Messages | {} |\n\
             | Enums | {} |\n\
             | External | {} |\n\
             | Dependencies | {} |\n\n",
            files.len(),
            services,
            messages,
            enums,
            externals,
            model.edges.len()
        )
    }

    fn render_services_section(model: &GraphModel) -> String {
        let services: Vec<_> = model
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Service)
            .collect();

        if services.is_empty() {
            return String::new();
        }

        let mut output = format!(
            "<details>\n<summary>📡 Services ({})</summary>\n\n",
            services.len()
        );

        for service in services {
            output.push_str(&Self::render_service(service));
        }

        output.push_str("</details>\n\n");
        output
    }

    fn render_service(node: &Node) -> String {
        let mut output = format!(
            "#### {}\n**Package**: `{}` | **File**: `{}`\n\n",
            node.label, node.package, node.file
        );

        if let NodeDetails::Service { methods, .. } = &node.details
            && !methods.is_empty()
        {
            output.push_str("| Method | Input | Output |\n");
            output.push_str("|--------|-------|--------|\n");
            for method in methods {
                output.push_str(&format!(
                    "| {} | {} | {} |\n",
                    method.name, method.input_type, method.output_type
                ));
            }
            output.push('\n');
        }

        output
    }

    fn render_messages_section(model: &GraphModel) -> String {
        let messages: Vec<_> = model
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Message)
            .collect();

        if messages.is_empty() {
            return String::new();
        }

        let mut output = format!(
            "<details>\n<summary>📦 Messages ({})</summary>\n\n",
            messages.len()
        );

        for message in messages {
            output.push_str(&Self::render_message(message));
        }

        output.push_str("</details>\n\n");
        output
    }

    fn render_message(node: &Node) -> String {
        let mut output = format!(
            "#### {}\n**Package**: `{}` | **File**: `{}`\n\n",
            node.label, node.package, node.file
        );

        if let NodeDetails::Message { fields } = &node.details
            && !fields.is_empty()
        {
            output.push_str("| # | Field | Type | Label |\n");
            output.push_str("|---|-------|------|-------|\n");
            for field in fields {
                output.push_str(&format!(
                    "| {} | {} | {} | {} |\n",
                    field.number, field.name, field.type_name, field.label
                ));
            }
            output.push('\n');
        }

        output
    }

    fn render_enums_section(model: &GraphModel) -> String {
        let enums: Vec<_> = model
            .nodes
            .iter()
            .filter(|n| n.node_type == NodeType::Enum)
            .collect();

        if enums.is_empty() {
            return String::new();
        }

        let mut output = format!(
            "<details>\n<summary>🏷️ Enums ({})</summary>\n\n",
            enums.len()
        );

        for enum_node in enums {
            output.push_str(&Self::render_enum(enum_node));
        }

        output.push_str("</details>\n\n");
        output
    }

    fn render_enum(node: &Node) -> String {
        let mut output = format!(
            "#### {}\n**Package**: `{}` | **File**: `{}`\n\n",
            node.label, node.package, node.file
        );

        if let NodeDetails::Enum { values } = &node.details
            && !values.is_empty()
        {
            output.push_str("| Value | Number |\n");
            output.push_str("|-------|--------|\n");
            for value in values {
                output.push_str(&format!("| {} | {} |\n", value.name, value.number));
            }
            output.push('\n');
        }

        output
    }

    fn render_footer() -> String {
        "---\n*Generated by [Coral](https://github.com/daisuke8000/coral)*\n".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Edge;
    use crate::domain::node::{EnumValue, FieldInfo, MethodSignature, NodeDetails};

    fn create_test_model() -> GraphModel {
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
                                name: "name".to_string(),
                                number: 2,
                                type_name: "string".to_string(),
                                label: "optional".to_string(),
                            },
                        ],
                    },
                ),
                Node::new(
                    "user.v1.Status".to_string(),
                    NodeType::Enum,
                    "user.v1".to_string(),
                    "Status".to_string(),
                    "user/v1/user.proto".to_string(),
                    NodeDetails::Enum {
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
                    },
                ),
            ],
            edges: vec![Edge::new(
                "user.v1.UserService".to_string(),
                "user.v1.User".to_string(),
            )],
            packages: vec![],
        }
    }

    #[test]
    fn test_generate_contains_header() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("## 🪸 Coral Proto Dependency Analysis"));
    }

    #[test]
    fn test_generate_contains_overview() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("### Overview"));
        assert!(report.contains("| Services | 1 |"));
        assert!(report.contains("| Messages | 1 |"));
        assert!(report.contains("| Enums | 1 |"));
    }

    #[test]
    fn test_generate_contains_services() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("📡 Services (1)"));
        assert!(report.contains("#### UserService"));
        assert!(report.contains("| GetUser | GetUserRequest | User |"));
    }

    #[test]
    fn test_generate_contains_messages() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("📦 Messages (1)"));
        assert!(report.contains("#### User"));
        assert!(report.contains("| 1 | id | string | optional |"));
    }

    #[test]
    fn test_generate_contains_enums() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("🏷️ Enums (1)"));
        assert!(report.contains("#### Status"));
        assert!(report.contains("| UNKNOWN | 0 |"));
    }

    #[test]
    fn test_generate_contains_footer() {
        let model = create_test_model();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("*Generated by [Coral]"));
    }

    #[test]
    fn test_empty_model() {
        let model = GraphModel::new();
        let report = MarkdownReporter::generate(&model);
        assert!(report.contains("## 🪸 Coral"));
        assert!(report.contains("| Services | 0 |"));
        // No service/message/enum sections for empty model
        assert!(!report.contains("📡 Services"));
        assert!(!report.contains("📦 Messages"));
        assert!(!report.contains("🏷️ Enums"));
    }
}
