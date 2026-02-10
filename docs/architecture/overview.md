# Architecture Overview

## System Components

The DAG Visualization system is organized as a monorepo with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                      @dag-viz/app                       │
│              (React Application)                        │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┬────────────────┐
        │        │        │                │
        ▼        ▼        ▼                ▼
   ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐
   │ renderer│ │ physics  │ │text-      │ │    core      │
   │         │ │          │ │analysis   │ │              │
   └────┬────┘ └─────┬────┘ └─────┬─────┘ └──────┬───────┘
        │            │            │               │
        └────────────┴────────────┴───────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌──────────┐        ┌─────────┐
              │  utils   │        │  types  │
              │          │        │         │
              └──────────┘        └─────────┘
```

## Package Responsibilities

### @dag-viz/types
**Foundation layer** - Pure TypeScript type definitions
- Graph structures (Node, Edge, Layer, DAGGraph)
- Physics types (Particle, Force, PhysicsConfig)
- No runtime dependencies

### @dag-viz/utils
**Utility layer** - Cross-cutting concerns
- 3D vector math operations
- Data parsing and validation
- Color scaling and palettes
- Performance utilities (debounce, throttle)

### @dag-viz/core
**Domain logic layer** - Graph data structures
- DAGGraph class for managing graph state
- Graph operations (traversal, filtering, selection)
- DAG validation (acyclic constraint checking)
- State management

### @dag-viz/physics
**Physics simulation layer** - Force-directed layout
- Force implementations (repulsion, spring, anchoring, damping)
- PhysicsSimulation engine
- Spatial optimization (QuadTree, OctTree)
- Numerical integration

### @dag-viz/text-analysis
**Domain-specific processing layer**
- Text tokenization and normalization
- Word frequency analysis
- Time-sliced analysis
- Graph builders (text → DAG conversion)
- NVivo importer (future)

### @dag-viz/renderer
**Visualization layer** - Three.js/React Three Fiber
- 3D scene components
- Node, edge, and layer rendering
- Camera controls (orbit, zoom, pan)
- Interactive controls (drag, select)
- Custom materials and shaders

### @dag-viz/app
**Application layer** - User interface
- React application shell
- UI components (controls, panels)
- Data loading and management
- Orchestrates all packages

## Data Flow

1. **Input**: User loads JSON/CSV data
2. **Parse**: Data is validated and parsed into DAGGraph
3. **Transform**: Graph converted to physics Particles
4. **Simulate**: Physics engine computes positions
5. **Render**: Three.js renders 3D visualization
6. **Interact**: User interactions update state → repeat cycle

## Key Design Decisions

### Monorepo Structure
- **Why**: Clear boundaries, shared types, independent testing
- **Tool**: pnpm workspaces for efficient dependency management

### Force-Directed Layout
- **Why**: Reduces visual clutter, emphasizes relationships
- **How**: Repulsion within layers + spring forces across layers + layer anchoring

### React Three Fiber
- **Why**: Declarative 3D with React, good performance, active ecosystem
- **Alternative considered**: Plain Three.js (more verbose)

### TypeScript Project References
- **Why**: Incremental builds, enforces dependency graph
- **Benefit**: Fast rebuilds, prevents circular dependencies

## Performance Considerations

- **Spatial Partitioning**: QuadTree/OctTree for O(n log n) force calculations
- **Convergence Detection**: Stop simulation when stable
- **LOD**: Future consideration for very large graphs
