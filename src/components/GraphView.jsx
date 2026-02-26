import { useEffect, useRef } from 'react';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';

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
      // nodeVal drives sphere volume via the built-in renderer (radius = nodeRelSize × ∛nodeVal).
      // Using weight² gives radius ∝ weight^(2/3) for a clear word-cloud size spread.
      .nodeRelSize(0.3)
      .nodeVal((node) => Math.pow(node.weight || 10, 2))
      .nodeColor((node) => node.color || '#3b82f6')
      .nodeOpacity(0.85)
      // Extend mode: add label sprite on top of the built-in sphere instead of replacing it
      .nodeThreeObjectExtend(true)
      .nodeThreeObject((node) => {
        const showLabel = config.showLabels;
        const showField = config.showForceField;
        if (!showLabel && !showField) return false;

        const group = new THREE.Group();
        const approxRadius = 0.3 * Math.cbrt(Math.pow(node.weight || 10, 2));

        // Label sprite
        if (showLabel) {
          const sprite = new SpriteText(node.label || node.id);
          sprite.color = '#e2e8f0';
          sprite.textHeight = Math.max(2.5, approxRadius * 0.6);
          sprite.position.y = approxRadius + 3;
          sprite.fontFace = 'DM Sans, sans-serif';
          sprite.backgroundColor = 'rgba(15, 23, 42, 0.7)';
          sprite.padding = 1.5;
          sprite.borderRadius = 3;
          group.add(sprite);
        }

        // Force field sphere
        if (showField) {
          const fieldRadius = config.repulsionMaxDistance;
          const geometry = new THREE.SphereGeometry(fieldRadius, 24, 16);
          const material = new THREE.MeshBasicMaterial({
            color: node.color || '#3b82f6',
            transparent: true,
            opacity: 0.05,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
        }

        return group;
      })
      // --- Edge rendering ---
      .linkColor((link) => {
        const sourceNode = typeof link.source === 'object' ? link.source : null;
        if (sourceNode) {
          return getLayerColor(sourceNode.layer || 0);
        }
        return '#334155';
      })
      .linkVisibility(() => config.showLinks)
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
      .onNodeDrag((node) => {
        // Lock node to its layer plane (Z-axis) during drag
        if (node.layer !== undefined) {
          const targetZ = node.layer * config.layerSpacing;
          node.fz = targetZ;
          node.z = targetZ;
          if (node.__threeObj) {
            node.__threeObj.position.z = targetZ;
          }
        }
      })
      .onNodeDragEnd((node) => {
        node.fx = node.x;
        node.fy = node.y;
        if (node.layer !== undefined) {
          const targetZ = node.layer * config.layerSpacing;
          node.fz = targetZ;
        } else {
          node.fz = node.z;
        }
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

    // Remove cross-layer forces so dragging only affects same-layer nodes
    graph.d3Force('charge', null);
    graph.d3Force('link', null);

    graph.d3AlphaDecay(config.alphaDecay);
    graph.d3VelocityDecay(config.velocityDecay);

    // Set graph data
    graph.graphData(graphData);

    // Position camera for a horizontal front-on view of layer 0
    setTimeout(() => {
      graph.cameraPosition({ x: 0, y: 80, z: 700 }, { x: 0, y: 0, z: 0 }, 0);
    }, 100);

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

    graph.d3AlphaDecay(config.alphaDecay);
    graph.d3VelocityDecay(config.velocityDecay);

    // Update link visibility
    graph.linkVisibility(() => config.showLinks);

    // Refresh node Three.js objects when visual toggles change
    graph.nodeThreeObject(graph.nodeThreeObject());

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
