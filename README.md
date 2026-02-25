# 3D Layered DAG Visualization

Interactive 3D visualization tool for hierarchical layered directed acyclic graphs (DAGs), with a focus on time-sliced text/word frequency analysis.

Built with **React + Vite + 3d-force-graph + d3-force-3d + Three.js**.

![Stack: React, Three.js, d3-force-3d]

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app opens at `http://localhost:3000` with sample data pre-loaded.

---

## Project Structure

```
src/
├── main.jsx                  # Entry point
├── App.jsx                   # Root component, state management
├── components/
│   ├── GraphView.jsx         # 3D force graph rendering & interaction
│   ├── ControlPanel.jsx      # Side panel with force parameter sliders
│   ├── NodeInfo.jsx          # Selected node metadata overlay
│   └── StatusBar.jsx         # Bottom stats bar
├── data/
│   └── sampleData.js         # Sample data generator & parsers
├── hooks/
│   └── useForceConfig.js     # Force parameter state management
├── utils/
│   └── forces.js             # Custom d3-force-3d force functions
└── styles/
    └── global.css            # Application styles
```

---

```

### Node Fields

| Field       | Required | Description                                    |
|-------------|----------|------------------------------------------------|
| `id`        | Yes      | Unique identifier                              |
| `label`     | No       | Display label (defaults to `id`)               |
| `layer`     | Yes      | Integer layer/time index                       |
| `weight`    | No       | Node size weight (e.g., frequency). Default: 1 |
| `color`     | No       | Hex color. Auto-assigned by layer if omitted   |
| `metadata`  | No       | Arbitrary key-value pairs for inspection        |

### Link Fields

| Field    | Required | Description                         |
|----------|----------|-------------------------------------|
| `source` | Yes      | Source node `id`                    |
| `target` | Yes      | Target node `id` (must be in a later layer) |
| `value`  | No       | Edge weight/thickness. Default: 1   |

### Layer Fields

| Field   | Required | Description              |
|---------|----------|--------------------------|
| `label` | No       | Human-readable label     |
| `index` | Yes      | Integer layer index      |

---

## Customizing Forces

All force parameters are tunable via the control panel sliders:

| Parameter            | Description                                  | Default |
|----------------------|----------------------------------------------|---------|
| Layer Anchor Strength| How strongly nodes stick to their layer plane | 0.5     |
| Layer Spacing        | Distance between layer planes (world units)  | 120     |
| In-Layer Repulsion   | Repulsion between same-layer nodes           | -60     |
| Repulsion Range      | Max distance for in-layer repulsion          | 150     |
| Global Charge        | General node-node repulsion (all layers)     | -30     |
| Spring Strength      | Edge spring pull strength                    | 0.3     |
| Rest Length           | Natural length of edge springs               | 60      |
| Alpha Decay          | How fast the simulation cools (lower = longer)| 0.02   |
| Velocity Decay       | Friction/damping on node movement            | 0.4     |
---

## Dependencies

| Package           | Purpose                                 |
|-------------------|-----------------------------------------|
| `react`           | UI framework                            |
| `3d-force-graph`  | 3D force-directed graph visualization   |
| `d3-force-3d`     | 3D force simulation engine              |
| `three`           | WebGL 3D rendering                      |
| `three-spritetext`| Text labels in 3D scene                 |
| `vite`            | Build tool & dev server                 |

---
