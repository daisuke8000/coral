//! Domain types for the Coral graph model.
//!
//! This module contains the core domain types used to represent
//! the proto dependency graph:
//!
//! - [`Node`]: Represents a proto file
//! - [`Edge`]: Represents a dependency relationship
//! - [`Package`]: Groups nodes by protobuf package
//! - [`GraphModel`]: The complete graph structure

pub mod graph;
pub mod node;

pub use graph::{Edge, GraphModel, Package};
pub use node::{EnumInfo, EnumValue, FieldInfo, MessageDef, MethodSignature, Node, NodeDetails, NodeType};
