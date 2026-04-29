/**
 * StressBench.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A fixed-position overlay panel that:
 *   1. Lets you load any preset (or custom) benchmark scenario into the renderer
 *   2. Measures live FPS via requestAnimationFrame
 *   3. Reports JS heap usage via performance.memory (Chromium only; null elsewhere)
 *   4. Times simulation convergence by detecting when FPS stabilises
 *   5. Logs every run to a results table you can eyeball for threshold hunting
 *   6. Auto-runs all presets sequentially ("Run All")
 *   7. Exports results as Markdown (clipboard) or JSON (download) for .md docs
 *
 * ── Integration (two lines in App.jsx) ───────────────────────────────────────
 *
 *   import { StressBench } from './components/StressBench';
 *
 *   // Inside the graph-container div, alongside <NodeInfo />:
 *   <StressBench onLoadGraph={setGraphData} />

 *
 * ── Convergence heuristic ─────────────────────────────────────────────────────
 *   We sample FPS every 500 ms.  Once we collect 4 consecutive samples whose
 *   spread (max − min) is ≤ 3 fps we declare the simulation converged.
 *   This works without touching the physics engine internals.
 *
 * ── Threshold hunting guide ──────────────────────────────────────────────────
 *   • FPS < 30  → "struggling"  (orange)
 *   • FPS < 15  → "unusable"    (red)
 *   • Conv = ∞  → simulation never cooled within the 30 s observation window
 *   • Tab crash → reduce node count and try again; browser won't report this
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { generateBenchmarkGraph } from '../data/benchmarkDataGenerator';
// import './stress-bench.css';

// ─── Preset scenarios ────────────────────────────────────────────────────────

const PRESETS = [
  // Node-count tiers
  { label: '50 nodes · 3 L · 75 E',       nodes: 50,   layers: 3,  edges: 75,   group: 'nodes'   },
  { label: '200 nodes · 5 L · 400 E',      nodes: 200,  layers: 5,  edges: 400,  group: 'nodes'   },
  { label: '1 000 nodes · 8 L · 2 000 E',  nodes: 1000, layers: 8,  edges: 2000, group: 'nodes'   },
  { label: '5 000 nodes · 8 L · 5 000 E',  nodes: 5000, layers: 8,  edges: 5000, group: 'nodes'   },
  // Link density (fixed 500 nodes)
  { label: '500 nodes · 5 L · 50 E',       nodes: 500,  layers: 5,  edges: 50,   group: 'density' },
  { label: '500 nodes · 5 L · 5 000 E',    nodes: 500,  layers: 5,  edges: 5000, group: 'density' },
  // Layer extremes
  { label: '200 nodes · 1 L (repulsion)',   nodes: 200,  layers: 1,  edges: 0,    group: 'layers'  },
  { label: '200 nodes · 50 L · 300 E',      nodes: 200,  layers: 50, edges: 300,  group: 'layers'  },
];

const GROUP_LABELS = {
  nodes:   '↕ Node count tiers',
  density: '↔ Link density (500 nodes)',
  layers:  '⊕ Layer extremes',
};

// ─── FPS stability window ────────────────────────────────────────────────────

const STABILITY_SAMPLES = 4;      // consecutive half-second samples needed
const STABILITY_SPREAD  = 3;      // max fps spread (max − min) to call it stable
const CONV_TIMEOUT_MS   = 30_000; // give up after 30 s
const AUTORUN_GAP_MS    = 1500;   // pause between auto-run scenarios

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * @param {{
 *   onLoadGraph: (data: any) => void,
 *   simulationConverged?: boolean,
 * }} props
 */
export function StressBench({ onLoadGraph, simulationConverged }) {
  // ── UI state ────────────────────────────────────────────────────────────
  const [open,         setOpen]         = useState(true);
  const [customNodes,  setCustomNodes]  = useState(200);
  const [customLayers, setCustomLayers] = useState(5);
  const [customEdges,  setCustomEdges]  = useState(400);

  // ── Live metrics ─────────────────────────────────────────────────────────
  const [fps,       setFps]       = useState(null);
  const [memMB,     setMemMB]     = useState(null);
  const [convMs,    setConvMs]    = useState(null);   // settled value, null = not yet
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);      // seconds since bench start

  // ── Auto-run state ─────────────────────────────────────────────────────
  const [autoRun,      setAutoRun]      = useState({ active: false, index: 0 });
  const [exportNotice, setExportNotice] = useState('');
  const lastResultsLen = useRef(0);
  const autoTimerRef   = useRef(null);

  // ── Refs (avoid stale closures in rAF loop) ───────────────────────────
  const rafRef         = useRef(null);
  const frameCount     = useRef(0);
  const lastHalfSec    = useRef(performance.now());
  const benchStart     = useRef(null);
  const fpsSamples     = useRef([]);
  const converged      = useRef(false);
  const prevExternal   = useRef(undefined);
  const resultCounter  = useRef(0);
  const pendingMeta    = useRef(null);
  const resultSaved    = useRef(false);

  // ── Results log ──────────────────────────────────────────────────────────
  const [results, setResults] = useState([]);

  // ─── rAF measurement loop ───────────────────────────────────────────────
  const measureLoop = useCallback(() => {
    frameCount.current++;
    const now = performance.now();

    // Every 500 ms: compute FPS, check convergence, update elapsed
    if (now - lastHalfSec.current >= 500) {
      const dt     = now - lastHalfSec.current;
      const sample = Math.round((frameCount.current / dt) * 1000);

      setFps(sample);
      frameCount.current = 0;
      lastHalfSec.current = now;

      // Memory (Chrome / Chromium only)
      let mem = null;
      try { mem = performance.memory; } catch { /* not supported */ }
      const mb = mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null;
      setMemMB(mb);

      // Elapsed seconds
      if (benchStart.current !== null) {
        const sec = Math.round((now - benchStart.current) / 1000);
        setElapsed(sec);

        // Timeout: give up if we haven't converged within 30 s
        if (!converged.current && now - benchStart.current > CONV_TIMEOUT_MS) {
          converged.current = true;
          setConvMs(null); // null signals "never converged"
        }
      }

      // FPS-stability heuristic (only while not yet converged)
      if (!converged.current) {
        fpsSamples.current.push(sample);
        if (fpsSamples.current.length > STABILITY_SAMPLES)
          fpsSamples.current.shift();

        if (fpsSamples.current.length === STABILITY_SAMPLES) {
          const spread = Math.max(...fpsSamples.current) - Math.min(...fpsSamples.current);
          if (spread <= STABILITY_SPREAD && benchStart.current !== null) {
            converged.current = true;
            const ms = Math.round(now - benchStart.current);
            setConvMs(ms);
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(measureLoop);
  }, []);

  // Start / stop the rAF loop
  useEffect(() => {
    if (isRunning) {
      rafRef.current = requestAnimationFrame(measureLoop);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, measureLoop]);

  // Optional external convergence signal (only if your renderer exposes one)
  useEffect(() => {
    if (
      simulationConverged === true &&
      prevExternal.current !== true &&
      isRunning &&
      !converged.current &&
      benchStart.current !== null
    ) {
      converged.current = true;
      setConvMs(Math.round(performance.now() - benchStart.current));
    }
    prevExternal.current = simulationConverged;
  }, [simulationConverged, isRunning]);

  // Auto-save result once we have stable FPS + convergence decision
  useEffect(() => {
    if (!isRunning || resultSaved.current || !converged.current) return;
    if (fps === null || pendingMeta.current === null) return;

    const result = {
      id: ++resultCounter.current,
      ...pendingMeta.current,
      fps,
      memMB,
      convMs,
      time: new Date().toLocaleTimeString(),
    };
    setResults(prev => [result, ...prev.slice(0, 49)]); // keep latest 50
    resultSaved.current = true;
  }, [fps, memMB, convMs, isRunning]);

  // ─── Auto-run advancer ──────────────────────────────────────────────────
  // When auto-run is active and a result lands, schedule the next preset.
  useEffect(() => {
    if (!autoRun.active) {
      lastResultsLen.current = results.length;
      return;
    }
    if (results.length > lastResultsLen.current) {
      lastResultsLen.current = results.length;
      const nextIdx = autoRun.index + 1;

      if (nextIdx >= PRESETS.length) {
        setAutoRun({ active: false, index: 0 });
        setIsRunning(false);
        return;
      }

      autoTimerRef.current = setTimeout(() => {
        const p = PRESETS[nextIdx];
        setAutoRun({ active: true, index: nextIdx });
        loadScenario(p.nodes, p.layers, p.edges, p.label, p.group);
      }, AUTORUN_GAP_MS);

      return () => {
        if (autoTimerRef.current) {
          clearTimeout(autoTimerRef.current);
          autoTimerRef.current = null;
        }
      };
    }
  }, [results, autoRun.active, autoRun.index]);

  // ─── Load scenario ────────────────────────────────────────────────────────
  function loadScenario(nodes, layers, edges, label, group) {
    // Reset all state
    setFps(null);
    setMemMB(null);
    setConvMs(null);
    setElapsed(0);
    converged.current   = false;
    resultSaved.current = false;
    fpsSamples.current  = [];
    frameCount.current  = 0;
    lastHalfSec.current = performance.now();

    pendingMeta.current = { label, nodes, layers, edges, group: group ?? 'custom' };
    benchStart.current  = performance.now();

    onLoadGraph(generateBenchmarkGraph({ nodeCount: nodes, layerCount: layers, edgeCount: edges }));
    setIsRunning(true);
  }

  function stopBench() {
    // Cancel any pending auto-run advancement
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoRun({ active: false, index: 0 });

    // Snapshot current metrics if we haven't auto-saved yet
    if (!resultSaved.current && pendingMeta.current !== null) {
      const result = {
        id: ++resultCounter.current,
        ...pendingMeta.current,
        fps: fps ?? 0,
        memMB,
        convMs,
        time: new Date().toLocaleTimeString(),
      };
      setResults(prev => [result, ...prev.slice(0, 49)]);
      resultSaved.current = true;
    }
    setIsRunning(false);
  }

  // ─── Run all presets sequentially ─────────────────────────────────────────
  function runAll() {
    setResults([]);                         // start with a clean slate
    lastResultsLen.current = 0;
    setAutoRun({ active: true, index: 0 });
    const p = PRESETS[0];
    loadScenario(p.nodes, p.layers, p.edges, p.label, p.group);
  }

  // ─── Export helpers ───────────────────────────────────────────────────────
  function buildMarkdown() {
    if (results.length === 0) return '';

    // Results are stored newest-first; reverse so the markdown reads in run order
    const ordered = [...results].reverse();

    const lines = [];
    lines.push(`## Stress Bench Results — ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('### Environment');
    lines.push('');
    lines.push(`- **User agent:** \`${navigator.userAgent}\``);
    lines.push(`- **CPU cores:** ${navigator.hardwareConcurrency ?? 'unknown'}`);
    lines.push(`- **Device pixel ratio:** ${window.devicePixelRatio}`);
    lines.push(`- **Viewport:** ${window.innerWidth}×${window.innerHeight}`);
    if (performance.memory) {
      const heapLimitMB = Math.round(performance.memory.jsHeapSizeLimit / 1_048_576);
      lines.push(`- **JS heap limit:** ~${heapLimitMB.toLocaleString()} MB`);
    }
    lines.push('');

    // Group results by category for cleaner markdown
    const groups = ['nodes', 'density', 'layers', 'custom'];
    for (const g of groups) {
      const rows = ordered.filter(r => (r.group ?? 'custom') === g);
      if (rows.length === 0) continue;
      lines.push(`### ${groupHeading(g)}`);
      lines.push('');
      for (const r of rows) {
        // Trailing two spaces force a soft line break in markdown so each
        // field renders on its own line within the same scenario block.
        lines.push(`**Scenario:** ${r.label}  `);
        lines.push(`**Nodes:** ${r.nodes.toLocaleString()}  `);
        lines.push(`**Layers:** ${r.layers}  `);
        lines.push(`**Edges:** ${r.edges.toLocaleString()}  `);
        lines.push(`**FPS:** ${r.fps}  `);
        lines.push(`**Mem (MB):** ${r.memMB ?? '—'}  `);
        lines.push(`**Conv (ms):** ${r.convMs !== null ? r.convMs.toLocaleString() : '∞'}`);
        lines.push(''); // blank line separates scenarios
      }
    }

    // ── Threshold analysis ───────────────────────────────────────────────
    lines.push('### Thresholds');
    lines.push('');

    const tiers = ordered.filter(r => r.group === 'nodes');
    if (tiers.length > 0) {
      const lastGood   = [...tiers].reverse().find(r => r.fps >= 30);
      const firstBad   = tiers.find(r => r.fps < 30);
      const firstDead  = tiers.find(r => r.fps < 15);
      const firstNoConv = tiers.find(r => r.convMs === null);

      if (lastGood)    lines.push(`- Last node-count tier with **FPS ≥ 30**: \`${lastGood.label}\` — ${lastGood.fps} fps`);
      if (firstBad)    lines.push(`- First node-count tier with **FPS < 30**: \`${firstBad.label}\` — ${firstBad.fps} fps (struggling)`);
      if (firstDead)   lines.push(`- First node-count tier with **FPS < 15** (unusable): \`${firstDead.label}\` — ${firstDead.fps} fps`);
      if (firstNoConv) lines.push(`- First node-count tier where simulation **never converged** (>30 s): \`${firstNoConv.label}\``);
      if (!firstBad && !firstDead && !firstNoConv) {
        lines.push('- All node-count tiers stayed at FPS ≥ 30 and converged within 30 s — no upper bound found.');
      }
    } else {
      lines.push('- _(Run the node-count preset tier to populate threshold analysis.)_');
    }

    // Density comparison
    const dens = ordered.filter(r => r.group === 'density');
    if (dens.length === 2) {
      const sparse = dens.find(r => r.edges < dens[0].edges + dens[1].edges - r.edges) ?? dens[0];
      const dense  = dens.find(r => r !== sparse) ?? dens[1];
      const fpsDelta = sparse.fps - dense.fps;
      const convDelta = (dense.convMs ?? 0) - (sparse.convMs ?? 0);
      lines.push('');
      lines.push(`- **Link-density impact** (500 nodes, ${sparse.edges} → ${dense.edges} edges): FPS dropped by ${fpsDelta}, convergence ${convDelta > 0 ? `slowed by ${convDelta.toLocaleString()} ms` : `was ${Math.abs(convDelta).toLocaleString()} ms faster`}.`);
    }

    // Layer extremes
    const layers = ordered.filter(r => r.group === 'layers');
    if (layers.length > 0) {
      lines.push('');
      lines.push('- **Layer extremes:** see scenario blocks above. Note manually whether camera framing, zoom, and rotation remained usable.');
    }

    lines.push('');
    lines.push('_Generated by StressBench. FPS measured via requestAnimationFrame; memory via `performance.memory.usedJSHeapSize` (Chromium only); convergence detected when FPS spread ≤ 3 over 4 consecutive 500 ms windows or after a 30 s timeout._');

    return lines.join('\n');
  }

  function copyMarkdown() {
    const md = buildMarkdown();
    if (!md) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        () => flashNotice('✓ Markdown copied to clipboard'),
        () => downloadFile('stress-bench.md', md),
      );
    } else {
      downloadFile('stress-bench.md', md);
    }
  }

  function exportJSON() {
    if (results.length === 0) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      env: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        devicePixelRatio: window.devicePixelRatio,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      },
      results: [...results].reverse(),
    };
    downloadFile('stress-bench.json', JSON.stringify(payload, null, 2));
    flashNotice('✓ JSON downloaded');
  }

  function flashNotice(msg) {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(''), 2200);
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const liveFpsTier = !isRunning ? 'dim' : tierFor(fps);
  const memTier     = !isRunning || memMB === null ? 'dim' : 'blue';
  const convTier    = !isRunning ? 'dim' : (convMs === null && converged.current ? 'bad' : 'blue');

  return (
    <div className="sb-root">
      {/* ── Header ── */}
      <div className="sb-header">
        <span className="sb-title">⚡ STRESS BENCH</span>
        <button className="sb-collapse-btn" onClick={() => setOpen(v => !v)}>
          {open ? '▾' : '▸'}
        </button>
      </div>

      {/* ── Live metrics bar (always visible) ── */}
      <div className="sb-metrics-row">
        <MetricBox label="FPS"      value={fps   ?? '—'} tier={liveFpsTier} />
        <MetricBox label="MEM MB"   value={memMB ?? '—'} tier={memTier}     />
        <MetricBox
          label="CONV ms"
          value={
            !isRunning          ? '—'        :
            convMs !== null     ? convMs      :
            converged.current   ? '∞'         :
            `${elapsed}s…`
          }
          tier={convTier}
        />
      </div>

      {/* Auto-run progress / stop */}
      {autoRun.active && (
        <div className="sb-autorun-bar">
          <div className="sb-autorun-label">
            ⏵ Auto-run {autoRun.index + 1}/{PRESETS.length}: {PRESETS[autoRun.index].label}
          </div>
          <button className="sb-btn sb-btn--stop" style={{ marginTop: 4 }} onClick={stopBench}>
            ■ Stop auto-run
          </button>
        </div>
      )}

      {open && (
        <>
          {/* ── Run All button ── */}
          <div className="sb-group">
            <button
              className="sb-btn sb-btn--run-all"
              onClick={runAll}
              disabled={autoRun.active}
            >
              ▶▶ Run all 8 presets
            </button>
          </div>

          {/* ── Preset groups ── */}
          {['nodes', 'density', 'layers'].map(group => (
            <div key={group} className="sb-group">
              <div className="sb-group-label">{GROUP_LABELS[group]}</div>
              {PRESETS.filter(p => p.group === group).map((p, i) => (
                <button
                  key={i}
                  className="sb-btn"
                  onClick={() => loadScenario(p.nodes, p.layers, p.edges, p.label, p.group)}
                  disabled={autoRun.active}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ))}

          {/* ── Custom sliders ── */}
          <div className="sb-group">
            <div className="sb-group-label">✦ Custom</div>
            <SliderRow
              label={`Nodes: ${customNodes.toLocaleString()}`}
              min={1} max={6000} step={1}
              value={customNodes} onChange={setCustomNodes}
            />
            <SliderRow
              label={`Layers: ${customLayers}`}
              min={1} max={60} step={1}
              value={customLayers} onChange={setCustomLayers}
            />
            <SliderRow
              label={`Edges: ${customEdges.toLocaleString()}`}
              min={0} max={10000} step={50}
              value={customEdges} onChange={setCustomEdges}
            />
            <div className="sb-btn-row">
              <button
                className="sb-btn sb-btn--run"
                onClick={() =>
                  loadScenario(
                    customNodes, customLayers, customEdges,
                    `${customNodes}n·${customLayers}L·${customEdges}E`,
                    'custom',
                  )
                }
                disabled={autoRun.active}
              >
                ▶ Run
              </button>
              {isRunning && !autoRun.active && (
                <button className="sb-btn sb-btn--stop" onClick={stopBench}>
                  ■ Stop
                </button>
              )}
            </div>
          </div>

          {/* ── Results table + export ── */}
          {results.length > 0 && (
            <div className="sb-group">
              <div className="sb-results-header">
                <div className="sb-group-label">📋 Results ({results.length})</div>
                <button className="sb-clear-btn" onClick={() => setResults([])}>clear</button>
              </div>

              {/* Export buttons */}
              <div className="sb-export-row">
                <button className="sb-btn sb-btn--export" onClick={copyMarkdown}>
                  📝 Copy MD
                </button>
                <button className="sb-btn sb-btn--export" onClick={exportJSON}>
                  💾 Export JSON
                </button>
              </div>
              {exportNotice && <div className="sb-notice">{exportNotice}</div>}

              <div className="sb-table-wrap">
                <table className="sb-table">
                  <thead>
                    <tr>
                      {['#', 'Scenario', 'N', 'L', 'E', 'FPS', 'MEM', 'Conv ms'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td className="sb-cell--scenario" title={r.label}>{r.label}</td>
                        <td>{r.nodes.toLocaleString()}</td>
                        <td>{r.layers}</td>
                        <td>{r.edges.toLocaleString()}</td>
                        <td className={`sb-cell--fps sb-tier-${tierFor(r.fps)}`}>{r.fps}</td>
                        <td>{r.memMB ?? '—'}</td>
                        <td className={r.convMs === null ? 'sb-tier-bad' : ''}>
                          {r.convMs !== null ? r.convMs.toLocaleString() : '∞'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Threshold legend */}
              <div className="sb-hint">
                FPS colours: <span className="sb-tier-good">≥50 good</span>{' · '}
                <span className="sb-tier-ok">30–49 ok</span>{' · '}
                <span className="sb-tier-bad">15–29 struggling</span>{' · '}
                <span className="sb-tier-dead">&lt;15 unusable</span>
                {' · '}Conv ∞ = never converged (&gt;30 s)
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBox({ label, value, tier }) {
  return (
    <div className={`sb-metric-box sb-tier-${tier}`}>
      <div className="sb-metric-label">{label}</div>
      <div className={`sb-metric-value sb-tier-${tier}`}>{value}</div>
    </div>
  );
}

function SliderRow({ label, min, max, step, value, onChange }) {
  return (
    <div className="sb-slider-row">
      <div className="sb-slider-label">{label}</div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="sb-slider"
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map an fps number (or null) to one of the tier modifier-class suffixes. */
function tierFor(fps) {
  if (fps === null || fps === undefined) return 'idle';
  if (fps < 15) return 'dead';
  if (fps < 30) return 'bad';
  if (fps < 50) return 'ok';
  return 'good';
}

function groupHeading(g) {
  if (g === 'nodes')   return 'Node count tiers';
  if (g === 'density') return 'Link density (500 nodes)';
  if (g === 'layers')  return 'Layer extremes';
  return 'Custom runs';
}