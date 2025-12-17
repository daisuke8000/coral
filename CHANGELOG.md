# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-12-17

### Added
- Markdown reports and diff output for GitHub Actions PR comments (#2)

### Changed
- Update dependencies to latest versions (#3)
  - `prost`: 0.13 → 0.14
  - `thiserror`: 1.0 → 2.0
  - `axum`: 0.7 → 0.8
  - `tower-http`: 0.5 → 0.6

## [0.1.1] - 2025-12-16

### Added
- Responsive mobile UI support (#1)

## [0.1.0] - 2025-12-14

### Added
- Initial release of Coral CLI tool
- Parse `FileDescriptorSet` binary from stdin (`buf build -o -`)
- Axum-based JSON API server (`/api/graph`, `/health`)
- React Flow frontend with Neon dark theme
- Node types: Service (magenta), Message (cyan), Enum (yellow), External (gray)
- Package grouping with expand/collapse
- Dagre auto-layout for graph visualization
- Expandable RPC type display in DetailPanel
- Resizable drawer and horizontal scroll
- GitHub Pages deployment workflow

### Security
- Prevent script injection via process.env

[0.1.2]: https://github.com/daisuke8000/coral/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/daisuke8000/coral/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/daisuke8000/coral/releases/tag/v0.1.0
