/**
 * Graph data utilities — color palette + parsers for accepted input shapes
 * (`{ nodes, links, layers }` graph format and `{ timeSlices }` word-frequency
 * format) plus a small fetch helper.
 */

// Layer color palette
export const LAYER_COLORS = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#34d399', // emerald
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#ec4899', // pink
];

export function getLayerColor(layerIndex) {
  return LAYER_COLORS[layerIndex % LAYER_COLORS.length];
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

  const processedLinks = (links || []).map((link) => ({
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