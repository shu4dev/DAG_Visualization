/**
 * benchmarkDataGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates synthetic graph data in the *internal* shape the renderer expects
 * (the same shape `parseAnyGraphInput` produces), so it can be fed straight
 * into setGraphData() without going through file-upload validation.
 */

export function generateBenchmarkGraph(params) {
  const { nodeCount, edgeCount } = params;
  const layerCount = Math.max(1, params.layerCount);

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const freq = Math.floor(lcgRand(i + 1) * 99) + 1;
    return {
      id: `bn-${i}`,
      label: `N${i}`,
      layer: i % layerCount,
      weight: freq,
      frequency: freq,
      metadata: { frequency: freq },
    };
  });

  const byLayer = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) byLayer[n.layer].push(n.id);

  const links = [];
  if (layerCount > 1 && edgeCount > 0) {
    const linkSet = new Set();
    const maxAttempts = Math.min(edgeCount * 8, 200_000);
    let seed = 42;
    for (let attempt = 0; attempt < maxAttempts && links.length < edgeCount; attempt++) {
      seed = lcgStep(seed);
      const srcLayerIdx = seed % (layerCount - 1);
      seed = lcgStep(seed);
      const tgtLayerIdx = srcLayerIdx + 1 + (seed % (layerCount - 1 - srcLayerIdx));
      const srcBucket = byLayer[srcLayerIdx];
      const tgtBucket = byLayer[tgtLayerIdx];
      if (srcBucket.length === 0 || tgtBucket.length === 0) continue;
      seed = lcgStep(seed);
      const source = srcBucket[seed % srcBucket.length];
      seed = lcgStep(seed);
      const target = tgtBucket[seed % tgtBucket.length];
      const key = `${source}→${target}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source, target });
      }
    }
  }

  return { nodes, links };
}

function lcgStep(s) { return ((s * 1664525 + 1013904223) >>> 0); }
function lcgRand(index) { return (lcgStep(index) / 0xffffffff); }