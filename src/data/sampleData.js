/**
 * Sample Data Generator
 * 
 * Generates layered DAG data representing time-sliced word frequencies.
 * Each time slice is a layer; nodes are words with frequency-based weights.
 * Edges connect the same word across adjacent time slices.
 */

// Layer color palette
export const LAYER_COLORS = [
  '#3b82f6',
  '#06b6d4',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#6366f1',
  '#ec4899',
];

export function getLayerColor(layerIndex) {
  return LAYER_COLORS[layerIndex % LAYER_COLORS.length];
}

/**
 * Generate a sample time-sliced word frequency DAG.
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

  const wordData = {
    AI: [120, 140, 158, 155, 170],
    data: [110, 105, 108, 100, 95],
    model: [90, 95, 108, 115, 120],
    agent: [8, 22, 50, 95, 145],
    transformer: [30, 52, 80, 108, 125],
    safety: [12, 28, 58, 85, 110],
    reasoning: [18, 32, 55, 80, 100],
    alignment: [8, 18, 32, 55, 80],
    learning: [70, 72, 68, 72, 70],
    training: [60, 62, 65, 60, 58],
    neural: [55, 58, 60, 58, 55],
    cloud: [65, 60, 55, 50, 45],
    network: [40, 38, 35, 32, 30],
    inference: [18, 25, 32, 42, 50],
    multimodal: [10, 20, 38, 52, 65],
    GPU: [28, 32, 35, 30, 28],
    deployment: [22, 28, 30, 35, 38],
    attention: [20, 30, 45, 50, 58],
    edge: [6, 10, 18, 28, 38],
    machine: [48, 45, 40, 35, 30],
  };

  const nodes = [];

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
          metadata: {
            word,
            timeSlice: timeSlices[t].label,
            frequency: freq,
            trend: t > 0 ? freq - frequencies[t - 1] : 0,
          },
        });
      }
    }
  }

  return {
    nodes,
    links: [],
    layers: timeSlices,
  };
}

/**
 * Normalize graph-shaped data into renderer format.
 */
export function parseGraphData(jsonData) {
  const nodes = Array.isArray(jsonData?.nodes) ? jsonData.nodes : [];
  const links = Array.isArray(jsonData?.links) ? jsonData.links : [];
  const layers = Array.isArray(jsonData?.layers) ? jsonData.layers : [];

  const processedNodes = nodes.map((node) => ({
    ...node,
    color: node.color || getLayerColor(node.layer || 0),
    weight: node.weight ?? 1,
    label: node.label || node.id,
    metadata: node.metadata || {},
  }));

  const processedLinks = links.map((link) => ({
    ...link,
    value: link.value ?? 1,
  }));

  return {
    nodes: processedNodes,
    links: processedLinks,
    layers,
  };
}

/**
 * Parse raw time-sliced word frequency data into graph format.
 */
export function parseRawWordFrequencyData(rawData) {
  const timeSlices = Array.isArray(rawData?.timeSlices) ? rawData.timeSlices : [];

  const layers = timeSlices.map((slice, index) => ({
    label: slice.label || `Layer ${index}`,
    index,
  }));

  const nodes = [];
  const links = [];
  const wordOccurrences = new Map();

  timeSlices.forEach((slice, layerIndex) => {
    const layerLabel = slice.label || `Layer ${layerIndex}`;
    const words = Array.isArray(slice.words) ? slice.words : [];

    words.forEach((entry) => {
      const word = entry.word;
      const frequency = entry.frequency ?? 1;

      if (!word) return;

      const nodeId = `${word}_${layerIndex}`;

      nodes.push({
        id: nodeId,
        label: word,
        layer: layerIndex,
        layerLabel,
        weight: frequency,
        color: getLayerColor(layerIndex),
        metadata: {
          word,
          timeSlice: layerLabel,
          frequency,
        },
      });

      if (!wordOccurrences.has(word)) {
        wordOccurrences.set(word, []);
      }

      wordOccurrences.get(word).push({
        id: nodeId,
        layer: layerIndex,
        frequency,
      });
    });
  });

  for (const [word, occurrences] of wordOccurrences.entries()) {
    occurrences.sort((a, b) => a.layer - b.layer);

    for (let i = 0; i < occurrences.length - 1; i++) {
      const current = occurrences[i];
      const next = occurrences[i + 1];

      if (next.layer === current.layer + 1) {
        links.push({
          source: current.id,
          target: next.id,
          value: Math.min(current.frequency, next.frequency),
          metadata: {
            word,
            type: 'temporal',
          },
        });
      }
    }
  }

  return parseGraphData({ nodes, links, layers });
}

/**
 * Universal parser
 */
export function parseAnyGraphInput(jsonData) {
  if (Array.isArray(jsonData?.nodes)) {
    return parseGraphData(jsonData);
  }

  if (Array.isArray(jsonData?.timeSlices)) {
    return parseRawWordFrequencyData(jsonData);
  }

  throw new Error(
    'Unsupported JSON format. Expected either { nodes, links, layers } or { timeSlices }.'
  );
}

/**
 * Fetch graph data from API
 */
export async function fetchGraphData(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseAnyGraphInput(data);
}