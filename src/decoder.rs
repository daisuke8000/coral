use crate::error::{CoralError, Result};
use prost::Message;
use prost_types::FileDescriptorSet;

pub fn decoder(bytes: &[u8]) -> Result<FileDescriptorSet> {
    if bytes.is_empty() {
        return Err(CoralError::EmptyInput);
    }

    let fds =
        FileDescriptorSet::decode(bytes).map_err(|e| CoralError::InvalidProtobuf { source: e })?;

    if fds.file.is_empty() {
        return Err(CoralError::NoProtoFiles);
    }

    Ok(fds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_input() {
        let result = decoder(&[]);
        assert!(matches!(result, Err(CoralError::EmptyInput)));
    }

    #[test]
    fn test_invalid_protobuf() {
        let invalid = b"not a valid protobuf";
        let result = decoder(invalid);
        assert!(matches!(result, Err(CoralError::InvalidProtobuf { .. })));
    }
}
