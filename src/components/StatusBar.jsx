/**
 * StatusBar Component
 * 
 * Shows stats about the current graph at the bottom of the viewport.
 */
export default function StatusBar({ graphData }) {
  const nodeCount = graphData.nodes?.length || 0;
  const linkCount = graphData.links?.length || 0;
  const layerCount = new Set(graphData.nodes?.map((n) => n.layer)).size;

  return (
    <div className="status-bar">
      <div className="stat">
        <span>Nodes:</span>
        <span className="stat-value">{nodeCount}</span>
      </div>
      <div className="stat">
        <span>Edges:</span>
        <span className="stat-value">{linkCount}</span>
      </div>
      <div className="stat">
        <span>Layers:</span>
        <span className="stat-value">{layerCount}</span>
      </div>
    </div>
  );
}
