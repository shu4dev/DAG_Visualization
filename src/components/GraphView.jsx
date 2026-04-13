import { useEffect, useRef, useMemo } from 'react';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { forceWithinLayerRepulsion, forceCrossLayerSpring } from '../utils/forces';
import { createHologramNode } from './HologramNode';
import FlyCamera from './Flycamera';

/**
 * GraphView Component
 *
 * Renders the 3D force-directed layered DAG using 3d-force-graph.
 * Applies two custom forces:
 *   1. Within-layer repulsion  — spreads same-layer nodes apart
 *   2. Cross-layer springs     — pulls connected nodes toward x-y alignment
 * Z positions are locked to layer planes; only x-y are free.
 */
export default function GraphView({
  graphData,
  config,
  onNodeSelect,
  selectedNode,
  resetViewTrigger,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const linksRef = useRef(null);
  const repulsionRef = useRef(null);
  const springRef = useRef(null);
  const configRef = useRef(config);

  // Shared with FlyCamera — when true, click handlers are skipped
  const flyActiveRef = useRef(false);
  const layerSpacing = config.layerSpacing;

  const filteredGraphData = useMemo(() => {
    if (!graphData?.nodes || !graphData?.links) {
      return { nodes: [], links: [] };
    }
    return graphData;
  }, [graphData]);

  // Initialize the graph
  useEffect(() => {
    if (!containerRef.current) return;

    
    const graph = ForceGraph3D()(containerRef.current)
      .backgroundColor('#0a0e17')
      .showNavInfo(false)
      //graph.width(containerRef.current.clientWidth);
      //graph.height(containerRef.current.clientHeight);

      // --- Node rendering (fully custom hologram) ---
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((node) => {
        const cfg = configRef.current;
        const isSelected = selectedNode && selectedNode.id === node.id;
        const group = createHologramNode(node);
      
        const s = 0.5 + (node.weight || 10) / 50;
        const outerRadius = 8.5 * s;

        {
          const sprite = new SpriteText(node.label || node.id);
          sprite.color = '#e2e8f0';
          sprite.textHeight = Math.max(2.5, outerRadius * 0.25);
          sprite.position.y = outerRadius + 3;
          sprite.fontFace = 'DM Sans, sans-serif';
          sprite.backgroundColor = isSelected
            ? 'rgba(15, 23, 42, 0.9)'
            : 'rgba(15, 23, 42, 0.7)';
          sprite.padding = isSelected ? 2.5 : 1.5;
          sprite.borderRadius = 3;
          group.add(sprite);
        }

      
        if (isSelected) {
          const ringGeometry = new THREE.SphereGeometry(outerRadius * 1.35, 24, 24);
          const ringMaterial = new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.18,
            wireframe: true,
          });
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          group.add(ring);
        }
      
        return group;
      })
      // --- Interaction ---
      .onNodeClick((node) => {
        if (flyActiveRef.current) return; // fly mode owns clicks

        if (onNodeSelect) onNodeSelect(node);

        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio + 30,
            z: node.z * distRatio + 40,
          },
          { x: node.x, y: node.y, z: node.z },
          900
        );
      })
      .onNodeDrag((node) => {
        // During drag: pin x/y to mouse position, keep z strictly on layer
        if (node._layerZ !== undefined) {
          node.z = node._layerZ;
          node.fz = node._layerZ;
          node.vz = 0;
        }
      })
      .onNodeDragEnd((node) => {
        // Release x/y pins so the simulation can take over again
        node.fx = undefined;
        node.fy = undefined;
        // Keep z strictly locked
        if (node._layerZ !== undefined) {
          node.z = node._layerZ;
          node.fz = node._layerZ;
          node.vz = 0;
        }
        graph.d3ReheatSimulation();
      })
      .onBackgroundClick(() => {
        if (flyActiveRef.current) return; // fly mode owns clicks
        if (onNodeSelect) onNodeSelect(null);
      });

    // ── Disable all default d3 forces ──
    graph.d3Force('charge', null);
    graph.d3Force('link', null);
    graph.d3Force('center', null);

    // ── Custom Force 1: Within-layer repulsion ──
    const repulsion = forceWithinLayerRepulsion(
      config.repulsionStrength,
      config.repulsionMaxDistance
    );
    graph.d3Force('withinLayerRepulsion', repulsion);
    repulsionRef.current = repulsion;

    // ── Custom Force 2: Cross-layer springs ──
    const spring = forceCrossLayerSpring(
      filteredGraphData.links,
      config.springStrength,
      config.springRestLength
    );
    graph.d3Force('crossLayerSpring', spring);
    springRef.current = spring;

    // ── Set simulation damping (velocityDecay) ──
    graph.d3VelocityDecay(config.damping);

    // ── Position nodes: random x/y (FREE), z strictly locked to layer ──
    const layers = filteredGraphData.nodes.map((n) => n.layer !== undefined ? n.layer : 0);
    const midLayer = (Math.min(...layers) + Math.max(...layers)) / 2;
    for (const node of filteredGraphData.nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - midLayer) * layerSpacing;

      // Z is STRICTLY pinned to layer plane — no displacement
      node.z = exactZ;
      node.fz = exactZ;
      node.vz = 0;
      node._layerZ = exactZ; // stash for hard reset each tick

      // x/y are FREE — the simulation will move them via repulsion + springs
      if (node.x === undefined) node.x = (Math.random() - 0.5) * 200;
      if (node.y === undefined) node.y = (Math.random() - 0.5) * 200;
      // Do NOT set fx/fy — leave them free for the force simulation
    }

    // ── Build link pairs from actual graph links for visual lines ──
    // We need node references resolved by id for drawing lines.
    // At this point nodes have positions but graphData hasn't been fed to the
    // graph yet (which would mutate link.source/target to objects), so we
    // resolve manually from our own node array.
    const nodeById = new Map();
    for (const node of filteredGraphData.nodes) nodeById.set(node.id, node);

    const linkPairs = []; // flat array: [srcNode, tgtNode, srcNode, tgtNode, …]
    for (const link of filteredGraphData.links) {
      const src = typeof link.source === 'object' ? link.source : nodeById.get(link.source);
      const tgt = typeof link.target === 'object' ? link.target : nodeById.get(link.target);
      if (src && tgt) {
        linkPairs.push(src, tgt);
      }
    }
    const totalSegments = linkPairs.length / 2;

    // Set graph data (simulation starts with already-pinned nodes)
    graph.graphData({
      nodes: graphData.nodes || [],
      links: graphData.links || []
    });


    // ── Build fat LineSegments2 for actual spring links ──
    const posArray = new Float32Array(totalSegments * 6); // 2 vertices × 3 components
    for (let s = 0; s < totalSegments; s++) {
      const src = linkPairs[s * 2];
      const tgt = linkPairs[s * 2 + 1];
      posArray[s * 6]     = src.x; posArray[s * 6 + 1] = src.y; posArray[s * 6 + 2] = src.z;
      posArray[s * 6 + 3] = tgt.x; posArray[s * 6 + 4] = tgt.y; posArray[s * 6 + 5] = tgt.z;
    }

    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(posArray);

    const renderer = graph.renderer();
    const size = new THREE.Vector2();
    renderer.getSize(size);

    const lineMaterial = new LineMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.5,
      linewidth: 3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      resolution: size,
    });

    const lineSegments = new LineSegments2(lineGeometry, lineMaterial);

    graph.scene().add(lineSegments);
    linksRef.current = { lineSegments, lineGeometry, lineMaterial, linkPairs, posArray };

    // ── Update visuals each tick ──
    graph.onEngineTick(() => {
      // HARD Z-LOCK: force every node back to its exact layer z every tick.
      // This is belt-and-suspenders on top of fz — it catches any floating
      // point drift or vz leakage from the d3-force integration step.
      for (const node of filteredGraphData.nodes) {
        if (node._layerZ !== undefined) {
          node.z = node._layerZ;
          node.vz = 0;
        }
      }

      // Update link line positions
      if (linksRef.current) {
        const { linkPairs: pairs, posArray: pos } = linksRef.current;
        const segs = pairs.length / 2;
        for (let s = 0; s < segs; s++) {
          const src = pairs[s * 2];
          const tgt = pairs[s * 2 + 1];
          pos[s * 6]     = src.x; pos[s * 6 + 1] = src.y; pos[s * 6 + 2] = src.z;
          pos[s * 6 + 3] = tgt.x; pos[s * 6 + 4] = tgt.y; pos[s * 6 + 5] = tgt.z;
        }
        linksRef.current.lineGeometry.setPositions(pos);
      }
    });

    // ── Position camera to see all layers (layers are centered at z=0) ──
    setTimeout(() => {
      graph.cameraPosition({ x: 0, y: 80, z: 700 }, { x: 0, y: 0, z: 0 }, 0);
    }, 100);

    graphRef.current = graph;

    return () => {
      if (linksRef.current) {
        linksRef.current.lineGeometry.dispose();
        linksRef.current.lineMaterial.dispose();
        linksRef.current = null;
      }
      graph._destructor && graph._destructor();
    };
  }, [filteredGraphData, onNodeSelect]);
  // ── Update forces when physics config changes ──
  useEffect(() => {
    configRef.current = config;

    const graph = graphRef.current;
    if (!graph) return;

    // Update repulsion parameters
    if (repulsionRef.current) {
      repulsionRef.current.strength(config.repulsionStrength);
      repulsionRef.current.maxDistance(config.repulsionMaxDistance);
    }

    // Update spring parameters
    if (springRef.current) {
      springRef.current.strength(config.springStrength);
      springRef.current.restLength(config.springRestLength);
    }

    // Update simulation damping
    graph.d3VelocityDecay(config.damping);

    graph.d3ReheatSimulation();
  }, [config.repulsionStrength, config.repulsionMaxDistance, config.springStrength, config.springRestLength, config.damping]);

  // ── Update layer Z positions when layerSpacing changes ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const nodes = graph.graphData().nodes;
    const ls = nodes.map((n) => n.layer !== undefined ? n.layer : 0);
    const mid = (Math.min(...ls) + Math.max(...ls)) / 2;
    for (const node of nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - mid) * config.layerSpacing;
      node.z = exactZ;
      node.fz = exactZ;
      node.vz = 0;
      node._layerZ = exactZ;
    }

    graph.d3ReheatSimulation();
  }, [config.layerSpacing]);

  // Reset view button behavior
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Layers are centered at z=0
    const midZ = 0;

    graph.cameraPosition({ x: 0, y: 80, z: midZ + 700 }, { x: 0, y: 0, z: midZ }, 800);
  }, [resetViewTrigger, filteredGraphData]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);
        if (linksRef.current?.lineMaterial) {
          const renderer = graphRef.current.renderer();
          const sz = new THREE.Vector2();
          renderer.getSize(sz);
          linksRef.current.lineMaterial.resolution.set(sz.x, sz.y);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Graph canvas mounts here */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* HUD overlay sits above the canvas */}
      <FlyCamera graphRef={graphRef} flyActiveRef={flyActiveRef} containerRef={containerRef} />
    </div>
  );
}