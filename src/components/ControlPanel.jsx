import { useState } from 'react';
import { StressBench } from './StressBench';

/**
 * ControlPanel Component
 *
 * Provides sliders and controls for tuning force simulation parameters,
 * data source selection, and API endpoint input.
 *
 * Now also hosts a "Benchmark" tab that loads the StressBench overlay
 * inline rather than as a floating panel.
 */
export default function ControlPanel({
  config,
  updateConfig,
  onLoadSample,
  onLoadFromAPI,
  onFileUpload,
  onResetView,
  onLoadGraph,            // ← new: passed straight to StressBench
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('controls'); // 'controls' | 'bench'

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
          {/* Tab switcher */}
          <div className="panel-tabs">
            <button
              className={`panel-tab${tab === 'controls' ? ' active' : ''}`}
              onClick={() => setTab('controls')}
            >
              Controls
            </button>
            <button
              className={`panel-tab${tab === 'bench' ? ' active' : ''}`}
              onClick={() => setTab('bench')}
            >
              Benchmark
            </button>
          </div>

          {/*
            Both tab panes are always rendered so StressBench keeps measuring
            FPS/memory/convergence even while you're on the Controls tab.
            The inactive pane is just hidden with `display: none`.
          */}
          <div style={{ display: tab === 'controls' ? 'block' : 'none' }}>
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
                        e.target.value = '';
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

              {/* Force Parameters */}
              <div className="panel-section">
                <h2>Force Settings</h2>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Repulsion Strength</span>
                    <span className="value">{config.repulsionStrength}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={1}
                    value={config.repulsionStrength}
                    onChange={(e) => updateConfig('repulsionStrength', Number(e.target.value))}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Repulsion Range</span>
                    <span className="value">{config.repulsionMaxDistance}</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={1500}
                    step={10}
                    value={config.repulsionMaxDistance}
                    onChange={(e) => updateConfig('repulsionMaxDistance', Number(e.target.value))}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Spring Strength</span>
                    <span className="value">{config.springStrength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={config.springStrength}
                    onChange={(e) => updateConfig('springStrength', Number(e.target.value))}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Spring Rest Length</span>
                    <span className="value">{config.springRestLength}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={config.springRestLength}
                    onChange={(e) => updateConfig('springRestLength', Number(e.target.value))}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Damping</span>
                    <span className="value">{config.damping.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={config.damping}
                    onChange={(e) => updateConfig('damping', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Layout */}
              <div className="panel-section">
                <h2>Layout</h2>

                <div className="slider-control">
                  <div className="slider-label">
                    <span>Layer Spacing</span>
                    <span className="value">{config.layerSpacing}</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={400}
                    step={5}
                    value={config.layerSpacing}
                    onChange={(e) => updateConfig('layerSpacing', Number(e.target.value))}
                  />
                </div>
              </div>

              {/* View Controls */}
              <div className="panel-section">
                <h2>View Controls</h2>

                <div className="control-group">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (onResetView) onResetView();
                    }}
                  >
                    Reset View
                  </button>
                </div>

              </div>

          </div>

          {/*
            The Benchmark pane is also always mounted. While on the Controls
            tab a compact "live mini-bar" surfaces from inside it via fixed
            positioning so you can see FPS/MEM/CONV without leaving Controls.
          */}
          <div style={{ display: tab === 'bench' ? 'block' : 'none' }}>
            <StressBench onLoadGraph={onLoadGraph} showMiniBar={tab !== 'bench'} />
          </div>
          {/*
            We render StressBench's mini-bar above by passing showMiniBar.
            But the *component itself* must remain mounted in only one place
            to keep its single source of truth — so we render it always inside
            the bench pane and let CSS hide it. The mini-bar is rendered
            internally as a fixed-position element when showMiniBar is true.
          */}

        </>
      )}
    </div>
  );
}