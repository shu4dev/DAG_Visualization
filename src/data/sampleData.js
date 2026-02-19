/**
 * Sample Data Generator
 * 
 * Generates layered DAG data representing time-sliced word frequencies.
 * Each time slice is a layer; nodes are words with frequency-based weights.
 * Edges connect the same word across adjacent time slices.
 */

// Layer color palette
export const LAYER_COLORS = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#ec4899', // pink
];

export function getLayerColor(layerIndex) {
  return LAYER_COLORS[layerIndex % LAYER_COLORS.length];
}

/**
 * Generate a sample time-sliced word frequency DAG.
 * 
 * @returns {{ nodes: Array, links: Array, layers: Array }}
 */
export function generateSampleData() {
  const timeSlices = [
    { label: 'Jan 2025', index: 0 },
    { label: 'Feb 2025', index: 1 },
    { label: 'Mar 2025', index: 2 },
    { label: 'Apr 2025', index: 3 },
    { label: 'May 2025', index: 4 },
  ];

  // Words with their frequencies per time slice (0 = absent)
  const wordData = {
    'AI':           [80, 90, 95, 92, 100],
    'machine':      [60, 65, 62, 58, 55],
    'learning':     [70, 72, 68, 75, 78],
    'neural':       [40, 45, 50, 55, 60],
    'network':      [50, 48, 52, 50, 53],
    'transformer':  [30, 45, 60, 70, 85],
    'attention':    [25, 35, 50, 55, 65],
    'data':         [90, 88, 85, 82, 80],
    'model':        [75, 78, 82, 85, 88],
    'training':     [55, 58, 60, 62, 65],
    'inference':    [20, 30, 40, 50, 60],
    'GPU':          [35, 40, 45, 50, 55],
    'cloud':        [60, 58, 55, 52, 50],
    'edge':         [10, 15, 25, 35, 45],
    'deployment':   [30, 35, 38, 42, 48],
    'safety':       [15, 25, 40, 55, 70],
    'alignment':    [10, 20, 35, 50, 65],
    'agent':        [5,  15, 30, 55, 80],
    'reasoning':    [20, 25, 35, 50, 70],
    'multimodal':   [10, 20, 35, 50, 60],
  };

  const nodes = [];
  const links = [];

  // Create nodes for each word in each time slice
  for (const [word, frequencies] of Object.entries(wordData)) {
    for (let t = 0; t < timeSlices.length; t++) {
      const freq = frequencies[t];
      if (freq > 0) {
        nodes.push({
          id: `${word}_${t}`,
          label: word,
          layer: t,
          layerLabel: timeSlices[t].label,
          weight: freq,
          color: getLayerColor(t),
          // Metadata for inspection
          metadata: {
            word,
            timeSlice: timeSlices[t].label,
            frequency: freq,
            trend: t > 0 ? (freq - frequencies[t - 1]) : 0,
          },
        });
      }
    }
  }

  // Create edges connecting the same word across adjacent time slices
  for (const [word, frequencies] of Object.entries(wordData)) {
    for (let t = 0; t < timeSlices.length - 1; t++) {
      const currentFreq = frequencies[t];
      const nextFreq = frequencies[t + 1];
      if (currentFreq > 0 && nextFreq > 0) {
        links.push({
          source: `${word}_${t}`,
          target: `${word}_${t + 1}`,
          // Edge weight based on average frequency
          value: (currentFreq + nextFreq) / 2,
        });
      }
    }
  }

  return {
    nodes,
    links,
    layers: timeSlices,
  };
}

/**
 * Parse user-provided JSON data into the graph format.
 * Expected format:
 * {
 *   "nodes": [{ "id": "...", "label": "...", "layer": 0, "weight": 50, ... }],
 *   "links": [{ "source": "node1", "target": "node2", "value": 10 }],
 *   "layers": [{ "label": "Layer 0", "index": 0 }, ...]
 * }
 */
export function parseGraphData(jsonData) {
  const { nodes, links, layers } = jsonData;

  // Validate and assign colors if missing
  const processedNodes = nodes.map((node) => ({
    ...node,
    color: node.color || getLayerColor(node.layer || 0),
    weight: node.weight || 1,
    label: node.label || node.id,
    metadata: node.metadata || {},
  }));

  const processedLinks = links.map((link) => ({
    ...link,
    value: link.value || 1,
  }));

  return {
    nodes: processedNodes,
    links: processedLinks,
    layers: layers || [],
  };
}

/**
 * Fetch graph data from an API endpoint.
 * @param {string} url - The API endpoint URL
 * @returns {Promise<{ nodes: Array, links: Array, layers: Array }>}
 */
export async function fetchGraphData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return parseGraphData(data);
}
