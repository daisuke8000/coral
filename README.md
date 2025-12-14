# 🪸 Coral

Proto dependency visualizer for gRPC/Connect projects with a Neon-style interactive Web UI.

[![CI](https://github.com/daisuke8000/coral/actions/workflows/ci.yml/badge.svg)](https://github.com/daisuke8000/coral/actions/workflows/ci.yml)

**[Live Demo](https://daisuke8000.github.io/coral/)**

## Features

- **Interactive Visualization**: React Flow-based graph with zoom, pan, and explore
- **Neon Aesthetics**: Dark mode with glow effects and animated data flow
- **Package Grouping**: Organize nodes by package with expand/collapse functionality
- **Auto Layout**: Automatic graph layout using Dagre algorithm
- **Pipeline-Friendly**: `buf build -o - | coral serve` workflow
- **GitHub Action**: Automate proto analysis in your CI/CD pipeline
- **GitHub Pages**: Deploy interactive documentation for your proto files

## Quick Start

### CLI Usage

```bash
# Build from source
git clone https://github.com/daisuke8000/coral.git
cd coral
cargo build --release

# Visualize proto dependencies
cd your-proto-project
buf build -o - | /path/to/coral serve

# Or output as JSON
buf build -o - | coral --output json > graph.json
```

### GitHub Action

Add Coral to your workflow to automatically analyze proto dependencies on every PR:

> **Note**: The first run may take 3-5 minutes as it builds the Rust binary. Subsequent runs with caching will be faster.

```yaml
# .github/workflows/proto-analysis.yml
name: Proto Analysis

on:
  pull_request:
    paths:
      - 'proto/**'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Analyze Proto Dependencies
        uses: daisuke8000/coral@v0.1.0
        with:
          proto-path: 'proto'
          comment-on-pr: 'true'
```

## GitHub Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `proto-path` | Path to proto files directory | `proto` |
| `buf-config` | Path to buf.yaml configuration | `''` |
| `output-path` | Path to save output files | `coral-output` |
| `comment-on-pr` | Post summary as PR comment | `false` |
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |
| `generate-pages` | Generate static HTML for GitHub Pages | `false` |

## GitHub Action Outputs

| Output | Description |
|--------|-------------|
| `json-path` | Path to the generated JSON file |
| `html-path` | Path to the generated HTML directory |
| `summary` | Summary of proto dependencies |
| `files-count` | Number of proto files |
| `services-count` | Number of services |
| `messages-count` | Number of messages |

## Deploy to GitHub Pages

Deploy an interactive visualization of your proto dependencies:

```yaml
# .github/workflows/pages.yml
name: Deploy Proto Docs

on:
  push:
    branches: [main]
    paths:
      - 'proto/**'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate Pages
        uses: daisuke8000/coral@v0.1.0
        with:
          proto-path: 'proto'
          generate-pages: 'true'

      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'coral-output/html'

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

## Node Classification

| Type | Condition | Color |
|------|-----------|-------|
| **Service** | Contains `service` definitions | Magenta `#ff00ff` |
| **Message** | `message` definitions | Cyan `#00ffff` |
| **Enum** | `enum` definitions | Yellow `#ffcc00` |
| **Package** | Package grouping nodes | Periwinkle `#8080ff` |
| **External** | Paths starting with `google/` or `buf/` | Gray `#666666` |

## Development

```bash
# Build
cargo build --release

# Test
cargo test

# Run with sample protos
cd sandbox && buf build -o - | ../target/release/coral --output summary
```

### UI Development

```bash
cd ui
npm install
npm run dev        # Development server
npm run build      # Production build
npm run build:static  # Static build for GitHub Pages
```

## Architecture

```
coral/
├── src/
│   ├── main.rs       # CLI entry point
│   ├── lib.rs        # Public API
│   ├── decoder.rs    # Protobuf decoding
│   ├── analyzer.rs   # Graph analysis
│   ├── server.rs     # Axum web server
│   └── domain/       # Domain models
├── ui/               # React + Vite frontend
└── action.yml        # GitHub Action definition
```

## License

MIT
