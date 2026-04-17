# 3D Layered DAG Visualization

Interactive 3D visualization tool for hierarchical layered directed acyclic graphs (DAGs), with a focus on time-sliced text/word frequency analysis.  Built with React + Vite + 3d-force-graph + d3-force-3d + Three.js.

Built with **React + Vite + 3d-force-graph + d3-force-3d + Three.js**.

## Quick Start

```bash
npm install
npm run dev       # development server at http://localhost:3000
npm run build     # production build
npm run preview   # preview production build
```

The app opens at `http://localhost:3000` with sample data pre-loaded.

---

## Project Structure

```
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Root component, state management
│   ├── components/
│   │   ├── GraphView.jsx         # 3D force graph rendering & interaction
│   │   ├── HologramNode.js       # Custom Three.js hologram node builder
│   │   ├── ControlPanel.jsx      # Side panel with visual toggles
│   │   ├── NodeInfo.jsx          # Selected node metadata overlay
│   │   └── Flycamera.jsx         # Fly-through camera controller
│   ├── data/
│   │   └── sampleData.js         # Sample data generator & parsers
│   ├── hooks/
│   │   └── useForceConfig.js     # Visual config state management
│   ├── utils/
│   │   └── forces.js             # Custom d3-force-3d force functions
│   └── styles/
│       └── global.css            # Application styles
└── pipeline/
    ├── fetch_arxiv.py            # arXiv data extraction script
    ├── requirements.txt          # Python dependencies
    ├── schema.json               # JSON output schema
```

## Data Pipeline

Python scripts in `pipeline/` that fetch data from external sources, extract keywords, and output JSON files compatible with the visualization tool.

### Setup

```bash
cd pipeline
pip install -r requirements.txt
```

**Dependencies:** `arxiv`, `keybert`, `torch`, `sentence-transformers`

### arXiv Extractor

Fetches papers from arXiv by category, groups them into monthly time slices, and uses KeyBERT (transformer attention mechanism) to extract keywords.

```bash
# Default: cs.AI, 12 months, top 25 keywords
python fetch_arxiv.py

# Custom category and parameters
python fetch_arxiv.py --category cs.CL --months 6 --top 30 --per-month 300
```

| Flag          | Default            | Description                              |
|---------------|--------------------|------------------------------------------|
| `--category`  | `cs.AI`            | arXiv category (cs.CL, cs.LG, stat.ML…) |
| `--months`    | `12`               | Number of monthly layers                 |
| `--top`       | `25`               | Keywords per time slice                  |
| `--per-month` | `200`              | Max papers fetched per month             |
| `--model`     | `all-MiniLM-L6-v2` | Sentence-transformer model for KeyBERT   |
| `--output`    | `arxiv-data.json`  | Output file path                         |

Output is a JSON file in the time-sliced format:

```json
{
  "timeSlices": [
    {
      "label": "2025-01",
      "words": [
        { "word": "large language model", "frequency": 95 },
        { "word": "reinforcement learning", "frequency": 78 }
      ]
    }
  ]
}
```

Upload this file into the visualization via **Upload JSON** in the control panel.

## Controls

### Graph Viewport

| Action | Result |
|--------|--------|
| Click node | Select node & frame camera on it |
| Drag node | Reposition in X/Y plane (Z stays locked to its layer) |
| Drag background | Orbit camera |
| Scroll | Zoom in/out |

### Control Panel (right side)

- **Load Sample** — Load built-in test data
- **Upload JSON** — Load a JSON file from disk (pipeline output or custom)
- **API Endpoint + Fetch** — Load data from a REST API URL
- **Reset View** — Auto-frame camera to fit all layers
- **Show Links** — Toggle edge visibility
- **‹ / ›** — Collapse/expand the panel

### Fly Camera

Press **Tab** to toggle fly mode. While active:

| Key | Action |
|-----|--------|
| `W / S` | Move forward / backward |
| `A / D` | Strafe left / right |
| `Q / Space` | Ascend |
| `E / Ctrl` | Descend |
| `Shift` | 3× speed boost |
| Mouse | Look around (pointer lock) |
| `Esc` | Exit fly mode |

---

## Dependencies

| Package            | Purpose                               |
|--------------------|---------------------------------------|
| `react`            | UI framework                          |
| `react-dom`        | React DOM renderer                    |
| `3d-force-graph`   | 3D force-directed graph visualization |
| `d3-force-3d`      | 3D force simulation engine            |
| `three`            | WebGL 3D rendering                    |
| `three-spritetext` | Text labels in 3D scene               |
| `vite`             | Build tool & dev server               |

---