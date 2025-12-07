use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoralError {
    #[error("無効なprotobufバイナリ形式")]
    InvalidProtobuf {
        #[from]
        source: prost::DecodeError,
    },
    #[error("空の入力: FileDescriptorSetバイナリが必要です")]
    EmptyInput,
    #[error("protoファイルが見つかりません")]
    NoProtoFiles,
    #[error("I/Oエラー")]
    Io {
        #[from]
        source: std::io::Error,
    },
}