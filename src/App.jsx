import { useState, useCallback } from 'react';
import GraphView from './components/GraphView';
import ControlPanel from './components/ControlPanel';
import NodeInfo from './components/NodeInfo';
import { useForceConfig } from './hooks/useForceConfig';
import { useTheme } from './hooks/useTheme';
import { parseAnyGraphInput } from './data/sampleData';
import scrapyDeps from './data/scrapy-deps.json';

/**
 * App Component
 *
 * Root of the 3D Layered DAG Visualization application.
 * Manages graph data state, force configuration, and data loading.
 */
export default function App() {
  const [graphData, setGraphData] = useState(() => parseAnyGraphInput(scrapyDeps));
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
 
  const { config, updateConfig } = useForceConfig();
  const [theme, toggleTheme] = useTheme();

  // Load the built-in sample data
  const handleLoadSample = useCallback(() => {
    setError(null);
    const data = parseAnyGraphInput(scrapyDeps);
    setGraphData(data);
    setSelectedNode(null);
  }, []);
 
  // Load data from an uploaded JSON file
  const handleFileUpload = useCallback((file) => {
    setError(null);
 
    if (!file) {
      setError('No file selected');
      return;
    }
 
    const reader = new FileReader();
 
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
 
        if (typeof text !== 'string') {
          throw new Error('Failed to read file');
        }
 
        const json = JSON.parse(text);
 
        const hasGraphFormat =
          json &&
          Array.isArray(json.nodes) &&
          Array.isArray(json.links);
 
        const hasTimeSlicedFormat =
          json &&
          Array.isArray(json.timeSlices);
 
        if (!hasGraphFormat && !hasTimeSlicedFormat) {
          throw new Error(
            'Unsupported JSON format. Expected either graph format or time-sliced format.'
          );
        }
 
        const data = parseAnyGraphInput(json);
 
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
          throw new Error('Failed to parse graph data');
        }
 
        if (data.nodes.length === 0) {
          throw new Error('Invalid graph format: nodes cannot be empty');
        }
 
        const nodeIds = new Set();
        for (const node of data.nodes) {
          if (nodeIds.has(node.id)) {
            throw new Error(`Duplicate node id: ${node.id}`);
          }
          nodeIds.add(node.id);
        }
 
        const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
 
        for (const link of data.links) {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
 
          if (!sourceId || !targetId) {
            throw new Error('Invalid links: missing source or target');
          }
 
          if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
            throw new Error('Invalid link: source or target node does not exist');
          }
 
          const sourceNode = nodeMap.get(sourceId);
          const targetNode = nodeMap.get(targetId);
 
          if (sourceNode.layer > targetNode.layer) {
            throw new Error('Invalid edge: backward-pointing edges are not allowed');
          }
        }
 
        setGraphData(data);
        setSelectedNode(null);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error(err);
      }
    };
 
    reader.onerror = () => {
      setError('Failed to read file');
    };
 
    reader.readAsText(file);
  }, []);
 
  const handleResetView = useCallback(() => {
    setResetViewTrigger((prev) => prev + 1);
  }, []);
 
 
  return (
    <div className="app-container">
      {/* 3D Graph Viewport */}
      <div className="graph-container">
        <GraphView
          graphData={graphData}
          config={config}
          onNodeSelect={setSelectedNode}
          selectedNode={selectedNode}
          resetViewTrigger={resetViewTrigger}
          theme={theme}
        />
 
        {/* Selected node info overlay */}
        <NodeInfo node={selectedNode} />

        {/* Error banner */}
        {error && <div className="error-banner">{error}</div>}
      </div>
 
      {/* Side Panel */}
      <ControlPanel
        config={config}
        updateConfig={updateConfig}
        onLoadSample={handleLoadSample}
        onFileUpload={handleFileUpload}
        onResetView={handleResetView}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}