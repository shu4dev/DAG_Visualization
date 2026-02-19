/**
 * NodeInfo Component
 * 
 * Displays metadata about the currently selected node
 * as a floating panel over the graph.
 */
export default function NodeInfo({ node }) {
  if (!node) return null;

  const meta = node.metadata || {};
  const trend = meta.trend;
  const trendLabel = trend > 0 ? `+${trend}` : trend === 0 ? '—' : `${trend}`;
  const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#f43f5e' : '#64748b';

  return (
    <div className="node-info">
      <h3>{node.label || node.id}</h3>
      <div className="meta-row">
        <span className="meta-key">Layer</span>
        <span className="meta-value">{node.layerLabel || `Layer ${node.layer}`}</span>
      </div>
      <div className="meta-row">
        <span className="meta-key">Frequency</span>
        <span className="meta-value">{node.weight || '—'}</span>
      </div>
      {trend !== undefined && (
        <div className="meta-row">
          <span className="meta-key">Trend</span>
          <span className="meta-value" style={{ color: trendColor }}>
            {trendLabel}
          </span>
        </div>
      )}
      {/* Render any extra metadata */}
      {Object.entries(meta)
        .filter(([key]) => !['word', 'timeSlice', 'frequency', 'trend'].includes(key))
        .map(([key, val]) => (
          <div className="meta-row" key={key}>
            <span className="meta-key">{key}</span>
            <span className="meta-value">{String(val)}</span>
          </div>
        ))}
    </div>
  );
}
