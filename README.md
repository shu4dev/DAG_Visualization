# 3D Layered DAG Visualization

An interactive 3D visualization tool for hierarchical layered directed acyclic graphs (DAGs) with force-directed layout. Primary application: time-sliced text/word analysis.

## Features

- **Interactive 3D Visualization**: Rotate, pan, zoom, and explore layered graphs in 3D space
- **Force-Directed Layout**: Physics-based layout with:
  - Within-layer repulsion (reduces node overlap)
  - Cross-layer spring forces (aligns connected nodes)
  - Layer anchoring (maintains hierarchical structure)
  - Tunable parameters for customization
- **Time-Sliced Word Analysis**: Visualize word frequency changes across time periods
- **Node Interaction**: Select nodes to inspect metadata, drag nodes with physics re-stabilization
- **Flexible Data Format**: JSON/CSV input with extensible metadata

## Tech Stack

- **Frontend**: React + TypeScript
- **3D Rendering**: Three.js + React Three Fiber
- **Build Tool**: Vite
- **Monorepo**: pnpm workspaces
- **Testing**: Vitest
- **Linting**: ESLint + Prettier

## Project Structure

This is a monorepo containing 7 packages:

```
packages/
├── types/           - Shared TypeScript type definitions
├── utils/           - Utility functions (math, data, colors)
├── core/            - DAG data structures and operations
├── physics/         - Force-directed layout engine
├── text-analysis/   - Text processing and word frequency
├── renderer/        - Three.js/R3F visualization components
└── app/             - Main React application
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install pnpm if needed
npm install -g pnpm

# Install dependencies
pnpm install
```

### Development

```bash
# Start dev server (opens at http://localhost:3000)
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

## Sample Data

Sample data files are provided in `packages/app/public/sample-data/`:

- **simple-dag.json**: Basic 3-layer DAG example
- **word-frequency-timeline.json**: Time-sliced word frequency data (tech news, Jan-Apr 2025)

## Data Format

Input data follows this JSON structure:

```json
{
  "metadata": {
    "title": "Graph Title",
    "timeUnit": "month"
  },
  "layers": [
    { "id": "layer-0", "index": 0, "label": "January 2025" }
  ],
  "nodes": [
    {
      "id": "node-1",
      "label": "AI",
      "layerIndex": 0,
      "weight": 156,
      "metadata": { "frequency": 156 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "sourceId": "node-1",
      "targetId": "node-2"
    }
  ]
}
```

**Key constraints:**
- Edges must point forward (source layer < target layer)
- Layer indices must be sequential (0, 1, 2, ...)
- No cycles allowed (DAG property)

See [Data Formats Guide](docs/guides/data-formats.md) for details.

## Documentation

- [Getting Started](docs/guides/getting-started.md)
- [Data Formats](docs/guides/data-formats.md)
- [Architecture Overview](docs/architecture/overview.md)
- [API Documentation](docs/api/)

## Project Goals (SMART)

Based on the [Project Requirements Document](Project_Requirement_Documents.pdf):

1. **Basic Prototype** (3 weeks): Working visualization with nodes, edges, 2+ layers
2. **Visualization of Change** (5 weeks): Word frequency changes across time layers
3. **Interaction & Navigation** (9 weeks): Full interaction (zoom, rotate, select, drag)

## Must-Have Features

- ✅ Layered DAG input format (JSON/CSV)
- ✅ Interactive 3D visualization with force-directed layout
- ✅ Camera controls (rotate, pan, zoom)
- ✅ Node selection and dragging with re-stabilization
- ✅ Tunable force parameters
- 🚧 Time-sliced text to layered DAG conversion

## Roadmap

### Current Focus
- Implement core visualization components
- Build physics simulation engine
- Create sample text analysis pipeline

### Future Enhancements
- NVivo integration for qualitative analysis workflows
- Automated text ingestion and time slicing
- Enhanced UI with presets and guided tours
- Performance optimizations for large graphs

## Development

### Monorepo Commands

```bash
# Run command in specific package
pnpm --filter app dev
pnpm --filter core test

# Run command in all packages
pnpm -r build          # All packages
pnpm -r --parallel test  # In parallel
```

### Adding Dependencies

```bash
# Add to specific package
pnpm --filter @dag-viz/core add lodash

# Add to root (dev dependencies)
pnpm add -D -w eslint
```

### Creating a Changeset

```bash
pnpm changeset
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure `pnpm lint` and `pnpm typecheck` pass
5. Create a changeset if needed
6. Submit a pull request

## Authors

- Brian Shu
- Erhan Huang
- Gian-Carlo Kekoa Panoy
- Xingyao He

## License

MIT

## References

- [Project Requirements PDF](Project_Requirement_Documents.pdf)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)
- [pnpm Workspaces](https://pnpm.io/workspaces)