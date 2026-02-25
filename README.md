# 3D Layered DAG Visualization

Interactive 3D visualization tool for hierarchical layered directed acyclic graphs (DAGs), with a focus on time-sliced text/word frequency analysis.

Built with **React + Vite + 3d-force-graph + d3-force-3d + Three.js**.

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