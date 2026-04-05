# Data Extraction Pipeline

Python scripts that fetch data from external sources, extract keywords, and output JSON files compatible with the visualization tool.

## Setup

```bash
cd pipeline
pip install -r requirements.txt
```

**Dependencies:** `arxiv`, `keybert`, `torch`, `sentence-transformers`

## arXiv Extractor

Fetches papers from arXiv by category, groups them into monthly time slices, and uses KeyBERT (transformer attention mechanism) to extract keywords.

```bash
# Default: cs.AI, 12 months, top 25 keywords
python fetch_arxiv.py

# Custom category and parameters
python fetch_arxiv.py --category cs.CL --months 6 --top 30 --per-month 300
```

### Options

| Flag           | Default            | Description                              |
|----------------|--------------------|------------------------------------------|
| `--category`   | `cs.AI`            | arXiv category (cs.CL, cs.LG, stat.ML…) |
| `--months`     | `12`               | Number of monthly layers                 |
| `--top`        | `25`               | Keywords per time slice                  |
| `--per-month`  | `200`              | Max papers fetched per month             |
| `--model`      | `all-MiniLM-L6-v2` | Sentence-transformer model for KeyBERT   |
| `--output`     | `arxiv-data.json`  | Output file path                         |

### Output

The script writes a JSON file in the **time-sliced format**:

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

## Writing New Extractors

Any script that outputs JSON conforming to `schema.json` will work with the visualization. The tool's `parseAnyGraphInput` function auto-detects two formats:

1. **Time-sliced** (`{ timeSlices: [...] }`): The tool generates nodes and temporal links automatically.
2. **Graph** (`{ nodes: [...], links: [...] }`): Pre-built graph with explicit connections.

See `schema.json` for the full specification.
