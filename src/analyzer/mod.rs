//! Analyzer module for converting FileDescriptorSet to GraphModel.

mod core;
mod edge_builder;
mod node_builder;
mod util;

pub use self::core::Analyzer;

#[cfg(test)]
mod regression_tests;
#[cfg(test)]
mod tests;
