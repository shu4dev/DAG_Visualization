import { useState } from 'react';

/**
 * ControlPanel Component
 *
 * Provides sliders and controls for tuning force simulation parameters,
 * data source selection, and API endpoint input.
 */
export default function ControlPanel({
  config,
  updateConfig,
  layers,
  onLoadSample,
  onLoadFromAPI,
  onFileUpload,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`control-panel${collapsed ? ' collapsed' : ''}`}>
      {/* Header */}
      <div className="panel-header">
        {!collapsed && <h1>DAG Explorer</h1>}
        {!collapsed && <span className="badge">3D</span>}
        <button
          className="panel-toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '‹' : '›'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Data Source */}
          <div className="panel-section">
            <h2>Data Source</h2>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={onLoadSample}>
                Load Sample
              </button>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Upload JSON
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onFileUpload) onFileUpload(file);
                  }}
                />
              </label>
            </div>

            {/* API Endpoint */}
            <div className="api-input-group">
              <input
                type="text"
                placeholder="https://api.example.com/graph"
                id="api-url-input"
              />
              <button
                className="btn"
                onClick={() => {
                  const url = document.getElementById('api-url-input')?.value;
                  if (url && onLoadFromAPI) onLoadFromAPI(url);
                }}
              >
                Fetch
              </button>
            </div>
          </div>

          {/* Layer Anchoring */}
          <div className="panel-section">
            <h2>Layer Anchoring</h2>
            <Slider
              label="Anchor Strength"
              value={config.layerStrength}
              min={0} max={1} step={0.05}
              onChange={(v) => updateConfig('layerStrength', v)}
            />
            <Slider
              label="Layer Spacing"
              value={config.layerSpacing}
              min={40} max={300} step={10}
              onChange={(v) => updateConfig('layerSpacing', v)}
            />
          </div>

          {/* Repulsion Forces */}
          <div className="panel-section">
            <h2>Repulsion Forces</h2>
            <Slider
              label="In-Layer Repulsion"
              value={config.repulsionStrength}
              min={-200} max={0} step={5}
              onChange={(v) => updateConfig('repulsionStrength', v)}
            />
            <Slider
              label="Repulsion Range"
              value={config.repulsionMaxDistance}
              min={50} max={400} step={10}
              onChange={(v) => updateConfig('repulsionMaxDistance', v)}
            />
            <Slider
              label="Global Charge"
              value={config.chargeStrength}
              min={-100} max={0} step={5}
              onChange={(v) => updateConfig('chargeStrength', v)}
            />
          </div>

          {/* Spring / Link Forces */}
          <div className="panel-section">
            <h2>Edge Springs</h2>
            <Slider
              label="Spring Strength"
              value={config.linkStrength}
              min={0} max={1} step={0.05}
              onChange={(v) => updateConfig('linkStrength', v)}
            />
            <Slider
              label="Rest Length"
              value={config.linkDistance}
              min={10} max={200} step={5}
              onChange={(v) => updateConfig('linkDistance', v)}
            />
          </div>

          {/* Damping */}
          <div className="panel-section">
            <h2>Damping / Stability</h2>
            <Slider
              label="Alpha Decay"
              value={config.alphaDecay}
              min={0.001} max={0.1} step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(v) => updateConfig('alphaDecay', v)}
            />
            <Slider
              label="Velocity Decay"
              value={config.velocityDecay}
              min={0.05} max={0.9} step={0.05}
              onChange={(v) => updateConfig('velocityDecay', v)}
            />
          </div>

          {/* Visual Settings */}
          <div className="panel-section">
            <h2>Visual</h2>
            <Slider
              label="Node Scale"
              value={config.nodeScale}
              min={0.3} max={3} step={0.1}
              onChange={(v) => updateConfig('nodeScale', v)}
            />
          </div>

          {/* Layer Legend */}
          {layers.length > 0 && (
            <div className="panel-section">
              <h2>Layers</h2>
              <div className="layer-legend">
                {layers.map((layer, i) => (
                  <div key={i} className="legend-item">
                    <div
                      className="legend-dot"
                      style={{
                        backgroundColor: [
                          '#3b82f6', '#06b6d4', '#8b5cf6',
                          '#f59e0b', '#10b981', '#f43f5e',
                          '#6366f1', '#ec4899',
                        ][i % 8],
                      }}
                    />
                    <span>{layer.label || `Layer ${layer.index}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Reusable Slider sub-component */
function Slider({ label, value, min, max, step, onChange, format }) {
  const display = format ? format(value) : (Number.isInteger(step) ? value : value.toFixed(2));
  return (
    <div className="slider-control">
      <div className="slider-label">
        <span>{label}</span>
        <span className="value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
