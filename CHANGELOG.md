# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Update reviewed Rust/frontend dependencies and Action pins; align UI builds and Node types on Node.js 26.
- Share definition cards and field tables while retaining neon styling, RPC expansion, selection, and mobile controls.
- Simplify analyzer passes/reference lookup and ordered diff indexes; share Markdown rendering without changing report formats.
- Build the Action's head descriptor once for JSON and Markdown; retain the separate base snapshot and checkout restoration.
- Document current CLI/static-server workflows, supported protobuf/diff scope, and explicit frontend checks. Defer TypeScript 7 updates until typescript-eslint supports them.

### Fixed
- Preserve nested definition identities, external descriptor provenance, RPC-only references, package-qualified field displays, and analyzer reuse; remove analyzer depth-32 truncation through iterative traversal.
- Detect same-name field/RPC changes, enum renumbering and declaration-order changes, and same-ID definition-kind replacements with deterministic diffs.
- Bound diff JSON reads while reading and count every service in CLI summaries, retaining top-level message/enum counts.
- Revalidate canonical Action paths after base checkout, including carriage-return/newline rejection before emitting path outputs.
- Keep only the package filter sheet visible when desktop dual panels resize to mobile; retain search focus and keyboard selection.
- Load Dagre on demand, guard obsolete layout results, and frame explicit layout changes with cancellable 500 ms camera transitions and reduced-motion support.
- Commit expansion/filter topology independently of lazy layout completion so dragging during chunk loading cannot leave a stale graph or overwrite manual positions.

## [0.1.8] - 2026-03-10

### Changed
- Modularize `analyzer.rs` into `analyzer/` submodules (mod.rs, core.rs, node_builder.rs, edge_builder.rs, util.rs)
- Modularize `diff.rs` into `diff/` submodules (mod.rs, core.rs, markdown.rs)
- Separate test files into dedicated `tests.rs` files

### Security
- Add stdin read size limit (256 MiB) to prevent OOM (H1)
- Log canonical path of `--static-dir` at startup (H2)
- Escape pipe and HTML chars in Markdown table cells (M1)
- Add recursion depth limit to nested message registration (H3)

## [0.1.7] - 2026-03-09

### Fixed
- Resolve mobile GPU crash and autolayout overlap (#7)

## [0.1.6] - 2025-12-23

### Changed
- Clean up comments in Cargo.toml

## [0.1.5] - 2025-12-23

### Fixed
- Show only diff in PR comments instead of full analysis (#6)

## [0.1.4] - 2025-12-17

### Added
- Release drafter and autolabeler (#4, #5)

### Changed
- Sync README inputs/outputs with action.yml

## [0.1.3] - 2025-12-17

### Added
- MIT License
- Package metadata (license, repository, description) in Cargo.toml

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

[Unreleased]: https://github.com/daisuke8000/coral/compare/v0.2.2...HEAD
[0.1.8]: https://github.com/daisuke8000/coral/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/daisuke8000/coral/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/daisuke8000/coral/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/daisuke8000/coral/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/daisuke8000/coral/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/daisuke8000/coral/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/daisuke8000/coral/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/daisuke8000/coral/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/daisuke8000/coral/releases/tag/v0.1.0
