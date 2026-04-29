/**
 * benchmarkDataGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates synthetic graph data in the *internal* shape the renderer expects
 * (the same shape `parseAnyGraphInput` produces), so it can be fed straight
 * into setGraphData() without going through file-upload validation.
 *
 * Internal shape (matches App.jsx + GraphView usage):
 *   {
 *     nodes: [{ id, label, layer, weight, frequency, metadata }, ...],
 *     links: [{ source, target }, ...],   // source/target are string node ids
 *   }
 *
 * @typedef {Object} BenchmarkParams
 * @property {number} nodeCount   Total number of nodes
 * @property {number} layerCount  Number of distinct layers (min 1)
 * @property {number} edgeCount   Desired forward-edge count (duplicates skipped)
 */

/**
 * @param {BenchmarkParams} params
 */
export function generateBenchmarkGraph(params) {
  const { nodeCount, edgeCount } = params;
  const layerCount = Math.max(1, params.layerCount);

  // ── Nodes ───────────────────────────────────────────────────────────────
  // Distribute nodes as evenly as possible across layers using round-robin so
  // no layer is ever empty (important for the single-layer repulsion test).
  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const freq = Math.floor(lcgRand(i + 1) * 99) + 1; // deterministic [1,100]
    return {
      id: `bn-${i}`,
      label: `N${i}`,
      layer: i % layerCount,           // <-- internal field name (singular)
      weight: freq,
      frequency: freq,                  // some renderers read this flat
      metadata: { frequency: freq },    // ...others read it nested
    };
  });

  // Build a lookup: layer → [nodeId, …] for edge sampling
  const byLayer = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) byLayer[n.layer].push(n.id);

  // ── Links ───────────────────────────────────────────────────────────────
  const links = [];

  // Single-layer graphs cannot have forward links (DAG constraint).
  if (layerCount > 1 && edgeCount > 0) {
    const linkSet = new Set();
    // Cap attempts so we don't block on impossible-to-fill graphs
    const maxAttempts = Math.min(edgeCount * 8, 200_000);
    let seed = 42;

    for (let attempt = 0; attempt < maxAttempts && links.length < edgeCount; attempt++) {
      // Pick source layer in [0, layerCount-2] and a strictly later target layer
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

// ─── Tiny deterministic LCG (no Math.random so results are reproducible) ────

function lcgStep(s) {
  // Parameters from Numerical Recipes
  return ((s * 1664525 + 1013904223) >>> 0); // unsigned 32-bit
}

/** Returns a value in [0, 1) from a seed index (not a state) */
function lcgRand(index) {
  return (lcgStep(index) / 0xffffffff);
}
