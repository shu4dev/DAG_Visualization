import { useEffect, useRef, useCallback } from 'react';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { forceLayerAnchor, forceWithinLayerRepulsion } from '../utils/forces';
import { getLayerColor } from '../data/sampleData';

/**
 * GraphView Component
 * 
 * Renders the 3D force-directed layered DAG using 3d-force-graph.
 * Applies custom forces for layer anchoring and within-layer repulsion.
 * Supports node selection, dragging, and real-time force parameter updates.
 */
export default function GraphView({ graphData, config, onNodeSelect }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const layerAnchorRef = useRef(null);
  const repulsionRef = useRef(null);

  // Initialize the graph
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = ForceGraph3D()(containerRef.current)
      .backgroundColor('#0a0e17')
      .showNavInfo(false)
      // --- Node rendering ---
      .nodeThreeObject((node) => {
        const group = new THREE.Group();

        // Sphere sized by weight
        const radius = Math.max(2, (node.weight || 10) / 10) * config.nodeScale;
        const geometry = new THREE.SphereGeometry(radius, 16, 12);
        const material = new THREE.MeshLambertMaterial({
          color: node.color || '#3b82f6',
          transparent: true,
          opacity: 0.85,
        });
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // Label
        if (config.showLabels) {
          const sprite = new SpriteText(node.label || node.id);
          sprite.color = '#e2e8f0';
          sprite.textHeight = Math.max(3, radius * 0.8);
          sprite.position.y = radius + 4;
          sprite.fontFace = 'DM Sans, sans-serif';
          sprite.backgroundColor = 'rgba(15, 23, 42, 0.7)';
          sprite.padding = 1.5;
          sprite.borderRadius = 3;
          group.add(sprite);
        }

        return group;
      })
      .nodeVal((node) => node.weight || 10)
      // --- Edge rendering ---
      .linkColor((link) => {
        const sourceNode = typeof link.source === 'object' ? link.source : null;
        if (sourceNode) {
          return getLayerColor(sourceNode.layer || 0);
        }
        return '#334155';
      })
      .linkOpacity(0.4)
      .linkWidth((link) => Math.max(0.5, (link.value || 1) / 30))
      // --- Interaction ---
      .onNodeClick((node) => {
        if (onNodeSelect) onNodeSelect(node);

        // Focus camera on clicked node
        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1000
        );
      })
      .onNodeDragEnd((node) => {
        // Fix node position after drag
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
      })
      .onBackgroundClick(() => {
        if (onNodeSelect) onNodeSelect(null);
      });

    // --- Add custom forces ---
    const layerAnchor = forceLayerAnchor(config.layerStrength, config.layerSpacing);
    const repulsion = forceWithinLayerRepulsion(config.repulsionStrength, config.repulsionMaxDistance);

    layerAnchorRef.current = layerAnchor;
    repulsionRef.current = repulsion;

    graph.d3Force('layerAnchor', layerAnchor);
    graph.d3Force('withinLayerRepulsion', repulsion);

    // Configure built-in d3 forces
    graph.d3Force('link')
      ?.strength(config.linkStrength)
      ?.distance(config.linkDistance);

    graph.d3Force('charge')
      ?.strength(config.chargeStrength);

    graph.d3AlphaDecay(config.alphaDecay);
    graph.d3VelocityDecay(config.velocityDecay);

    // Set graph data
    graph.graphData(graphData);

    // Position camera to see all layers
    const maxLayer = Math.max(...graphData.nodes.map((n) => n.layer || 0));
    const centerZ = (maxLayer * config.layerSpacing) / 2;
    setTimeout(() => {
      graph.cameraPosition({ x: 300, y: 200, z: centerZ }, { x: 0, y: 0, z: centerZ }, 1500);
    }, 500);

    graphRef.current = graph;

    // Cleanup
    return () => {
      graph._destructor && graph._destructor();
    };
  }, [graphData]); // Re-initialize when data changes

  // Update forces when config changes (without re-creating the graph)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Update custom forces
    if (layerAnchorRef.current) {
      layerAnchorRef.current.strength(config.layerStrength);
      layerAnchorRef.current.layerSpacing(config.layerSpacing);
    }
    if (repulsionRef.current) {
      repulsionRef.current.strength(config.repulsionStrength);
      repulsionRef.current.maxDistance(config.repulsionMaxDistance);
    }

    // Update built-in forces
    graph.d3Force('link')
      ?.strength(config.linkStrength)
      ?.distance(config.linkDistance);
    graph.d3Force('charge')
      ?.strength(config.chargeStrength);

    graph.d3AlphaDecay(config.alphaDecay);
    graph.d3VelocityDecay(config.velocityDecay);

    // Reheat simulation so changes take effect
    graph.d3ReheatSimulation();
  }, [config]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
