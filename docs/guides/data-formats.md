# Data Formats

## Layered DAG JSON Format

The visualization accepts a JSON format with the following structure:

```json
{
  "metadata": {
    "title": "Graph Title",
    "description": "Optional description",
    "timeUnit": "month",
    "dataSource": "source-identifier"
  },
  "layers": [
    {
      "id": "layer-0",
      "index": 0,
      "label": "Layer Label",
      "timestamp": "2025-01-01"
    }
  ],
  "nodes": [
    {
      "id": "node-1",
      "label": "Node Label",
      "layerIndex": 0,
      "weight": 100,
      "metadata": {
        "frequency": 100,
        "category": "technology"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "sourceId": "node-1",
      "targetId": "node-2",
      "metadata": {
        "type": "temporal-continuation",
        "strength": 0.95
      }
    }
  ]
}
```

## Field Descriptions

### Metadata
- `title`: Display title for the graph
- `description`: Optional description
- `timeUnit`: For time-series data (day, week, month, year, custom)
- `dataSource`: Identifier for data source

### Layers
- `id`: Unique layer identifier
- `index`: Integer layer position (0, 1, 2, ...)
- `label`: Display label
- `timestamp`: Optional ISO timestamp for time-series data

### Nodes
- `id`: Unique node identifier
- `label`: Display text
- `layerIndex`: Which layer this node belongs to
- `weight`: Optional numeric weight (affects visualization size)
- `metadata`: Arbitrary additional data

### Edges
- `id`: Unique edge identifier
- `sourceId`: ID of source node
- `targetId`: ID of target node (must be in later layer)
- `metadata`: Arbitrary additional data

## Constraints

1. Edges must only point forward (source layer < target layer)
2. Layer indices must be sequential integers starting from 0
3. All node layerIndex values must reference existing layers
4. All edge sourceId/targetId values must reference existing nodes

## Examples

See sample data files in `packages/app/public/sample-data/`:
- Simple 3-layer DAG: [simple-dag.json](../../packages/app/public/sample-data/simple-dag.json)
- Word frequency timeline: [word-frequency-timeline.json](../../packages/app/public/sample-data/word-frequency-timeline.json)
