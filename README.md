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

## Features

- **3D Force-Directed Layout**: Nodes arranged in layers along the Z axis with physics-based positioning
- **Custom Forces**:
  - Layer anchoring (nodes attracted to their layer plane)
  - Within-layer repulsion (same-layer nodes spread out)
  - Edge springs (connected nodes pull toward alignment)
  - Configurable damping and decay
- **Interactions**: Rotate, pan, zoom, click to inspect nodes, drag nodes with re-stabilization
- **Data Loading**: Built-in sample data, JSON file upload, or API endpoint fetching
- **Tunable Parameters**: Real-time sliders for all force parameters

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

## Data Format

The app expects graph data in this JSON structure:

```json
{
  "nodes": [
    {
      "id": "word_0",
      "label": "AI",
      "layer": 0,
      "weight": 80,
      "color": "#3b82f6",
      "metadata": {
        "word": "AI",
        "timeSlice": "Jan 2025",
        "frequency": 80,
        "trend": 0
      }
    }
  ],
  "links": [
    {
      "source": "word_0",
      "target": "word_1",
      "value": 85
    }
  ],
  "layers": [
    { "label": "Jan 2025", "index": 0 },
    { "label": "Feb 2025", "index": 1 }
  ]
}
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

## API Integration

To load data from an API, enter the endpoint URL in the control panel and click **Fetch**. The endpoint should return JSON in the format above.

Example API handler (Express.js):

```javascript
app.get('/api/graph', async (req, res) => {
  // Query your database, run text analysis, etc.
  const graphData = await buildGraphFromCorpus(req.query);
  res.json(graphData);
});
```

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

### Adding Custom Forces

Edit `src/utils/forces.js` to add new force functions. Any function following the d3-force interface can be registered:

```javascript
// In GraphView.jsx
graph.d3Force('myCustomForce', myForceFunction);
```

---

## Extending the Template

### Adding NVivo / External Tool Integration

1. Export data from NVivo as CSV or JSON
2. Write a parser in `src/data/` to convert to the graph format above
3. Add a new button in `ControlPanel.jsx` to trigger the import

### Adding a Backend

1. Create an API (Express, FastAPI, etc.) that serves graph data
2. Use the API URL input in the control panel, or
3. Modify `fetchGraphData()` in `sampleData.js` to point to your backend

### Deployment

```bash
npm run build
# Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.)
```

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

## License

MIT
