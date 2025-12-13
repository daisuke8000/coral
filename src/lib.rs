pub mod decoder;
pub mod error;

pub use error::{CoralError, Result};

use prost_types::FileDescriptorSet;
use std::io::Read;

pub fn read_stdin() -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    std::io::stdin()
        .read_to_end(&mut buffer)
        .map_err(|e| CoralError::Io { source: e })?;
    Ok(buffer)
}

pub fn debug_output(fds: &FileDescriptorSet) {
    println!("=== FileDescriptorSet Debug ===");
    println!("Total files: {}", fds.file.len());
    println!();

    for file in &fds.file {
        let name = file.name.as_deref().unwrap_or("<unknown>");
        let package = file.package.as_deref().unwrap_or("<unknown>");
        let msg = file.message_type.len();
        let srv = file.service.len();
        println!("📄 File: {}", name);
        println!("   Package: {}", package);
        println!("   Messages: {}", msg);
        println!("   Services: {}", srv);
        println!();
    }
}
