use std::io::Write;
use std::process::{Command, Stdio};

use prost::Message;
use prost_types::{
    DescriptorProto, EnumDescriptorProto, EnumValueDescriptorProto, FileDescriptorProto,
    FileDescriptorSet, ServiceDescriptorProto,
};

#[test]
fn summary_counts_all_services_and_only_top_level_messages_and_enums() {
    let enum_type = EnumDescriptorProto {
        name: Some("State".into()),
        value: vec![EnumValueDescriptorProto {
            name: Some("UNKNOWN".into()),
            number: Some(0),
            ..Default::default()
        }],
        ..Default::default()
    };
    let fds = FileDescriptorSet {
        file: vec![FileDescriptorProto {
            name: Some("summary.proto".into()),
            package: Some("p".into()),
            syntax: Some("proto3".into()),
            service: vec![
                ServiceDescriptorProto {
                    name: Some("First".into()),
                    ..Default::default()
                },
                ServiceDescriptorProto {
                    name: Some("Second".into()),
                    ..Default::default()
                },
            ],
            message_type: vec![DescriptorProto {
                name: Some("Outer".into()),
                nested_type: vec![DescriptorProto {
                    name: Some("Inner".into()),
                    ..Default::default()
                }],
                enum_type: vec![enum_type.clone()],
                ..Default::default()
            }],
            enum_type: vec![enum_type],
            ..Default::default()
        }],
    };
    let mut child = Command::new(env!("CARGO_BIN_EXE_coral"))
        .args(["--output", "summary"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    {
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(&fds.encode_to_vec()).unwrap();
    }
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    // Nested declarations are intentionally excluded from these summary counts.
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "Files: 1\nServices: 2\nMessages: 1\nEnums: 1\n"
    );
}
