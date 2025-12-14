//! Error types for the Coral library.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoralError {
    #[error("Empty input: FileDescriptorSet binary is required")]
    EmptyInput,

    #[error("Invalid protobuf binary format: {source}")]
    InvalidProtobuf {
        #[from]
        source: prost::DecodeError,
    },

    #[error("No proto files found in FileDescriptorSet")]
    NoProtoFiles,

    #[error("I/O error: {source}")]
    Io {
        #[from]
        source: std::io::Error,
    },
}

pub type Result<T> = std::result::Result<T, CoralError>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error;

    #[test]
    fn test_empty_input_error_message() {
        let err = CoralError::EmptyInput;
        assert_eq!(
            err.to_string(),
            "Empty input: FileDescriptorSet binary is required"
        );
    }

    #[test]
    fn test_invalid_protobuf_error_message() {
        let err = CoralError::InvalidProtobuf {
            source: prost::DecodeError::new("invalid protobuf binary"),
        };
        assert!(
            err.to_string()
                .starts_with("Invalid protobuf binary format:")
        );
        assert!(err.to_string().contains("invalid protobuf binary"));
    }

    #[test]
    fn test_no_proto_files_error_message() {
        let err = CoralError::NoProtoFiles;
        assert_eq!(err.to_string(), "No proto files found in FileDescriptorSet");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let coral_err: CoralError = io_err.into();
        assert!(matches!(coral_err, CoralError::Io { .. }));
        assert!(coral_err.to_string().starts_with("I/O error:"));
        assert!(coral_err.to_string().contains("file not found"));
        assert!(coral_err.source().is_some());
    }

    #[test]
    fn test_error_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<CoralError>();
    }
}
