import { useEffect, useRef, useMemo, useState } from 'react';
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
 *   3. Soft wall repulsion     — keeps nodes inside the stage bounds
 * Z positions are locked to layer planes; only x-y are free.
 *
 * Stage geometry mirrors the "Interactive Shadows" paper (UIST '92):
 *   floor + back wall + side wall forming a room corner, with orthographic
 *   shadow projections of each node onto all three surfaces.
 */
export default function GraphView({
  graphData,
  config,
  onNodeSelect,
  selectedNode,
  resetViewTrigger,
}) {
  const containerRef = useRef(null);
  const graphRef     = useRef(null);
  const linksRef     = useRef(null);
  const repulsionRef = useRef(null);
  const springRef = useRef(null);
  const configRef = useRef(config);
  const selectedNodeIdRef = useRef(null);
  const highlightNodeIdsRef = useRef(new Set());
  const highlightLinkIndicesRef = useRef(new Set());

  // Shared with FlyCamera — when true, click handlers are skipped
  const flyActiveRef = useRef(false);
  const layerSpacing = config.layerSpacing;

  const [highlightNodeIds, setHighlightNodeIds] = useState(new Set());
  const [highlightLinkIndices, setHighlightLinkIndices] = useState(new Set());

  const filteredGraphData = useMemo(() => {
    if (!graphData?.nodes || !graphData?.links) return { nodes: [], links: [] };
    return graphData;
  }, [graphData]);

  const getNodeId = (nodeOrId) =>
    typeof nodeOrId === 'object' ? nodeOrId.id : nodeOrId;
  const getSubgraph = (clickedNode, links) => {
    const clickedId = getNodeId(clickedNode);

    const nodeIds = new Set([clickedId]);
    const linkIndices = new Set();

    const queue = [clickedId];
    const visited = new Set([clickedId]);

    while (queue.length) {
      const current = queue.shift();

      links.forEach((link, index) => {
        const s = getNodeId(link.source);
        const t = getNodeId(link.target);

        if (s === current && !visited.has(t)) {
          visited.add(t);
          queue.push(t);
          nodeIds.add(t);
          linkIndices.add(index);
        }

        if (t === current && !visited.has(s)) {
          visited.add(s);
          queue.push(s);
          nodeIds.add(s);
          linkIndices.add(index);
        }
      });
    }

    return { nodeIds, linkIndices };
  };

  // Initialize the graph
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = ForceGraph3D()(containerRef.current)
      .backgroundColor('#1a2233')
      .showNavInfo(false)
      .linkOpacity(0) // we'll draw custom lines, so hide the built-in ones

      // ── Node rendering (fully custom hologram) ──
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((node) => {
        const isSelected = selectedNodeIdRef.current === node.id;
        const highlightSet = highlightNodeIdsRef.current;
        const isDimmed = highlightSet.size > 0 && !highlightSet.has(node.id);

        const group = createHologramNode({ ...node, isSelected, isDimmed });

        group.traverse((child) => {
          if (child.isMesh) child.castShadow = true;
        });

        const s           = 0.5 + (node.weight || 10) / 50;
        const outerRadius = 8.5 * s;

        const sprite          = new SpriteText(node.label || node.id);
        sprite.color          = '#e2e8f0';
        sprite.textHeight     = Math.max(2.5, outerRadius * 0.25);
        sprite.position.y     = outerRadius + 3;
        sprite.fontFace       = 'DM Sans, sans-serif';
        sprite.backgroundColor = isSelected
          ? 'rgba(15, 23, 42, 0.9)'
          : 'rgba(15, 23, 42, 0.7)';
        sprite.padding      = isSelected ? 2.5 : 1.5;
        sprite.borderRadius = 3;
        group.add(sprite);


        if (isSelected) {
          const ringMesh = new THREE.Mesh(
            new THREE.SphereGeometry(outerRadius * 1.35, 24, 24),
            new THREE.MeshBasicMaterial({
              color: '#ffffff',
              transparent: true,
              opacity: 0.18,
              wireframe: true,
            })
          );
          group.add(ringMesh);
        }

        return group;
      })

      // ── Interaction ──
      .onNodeClick((node) => {
        if (flyActiveRef.current) return;
        if (onNodeSelect) onNodeSelect(node);

        // caculate subgraph 
        const { nodeIds, linkIndices } = getSubgraph(node, graphData.links);
        selectedNodeIdRef.current = node.id;
        highlightNodeIdsRef.current = nodeIds;
        highlightLinkIndicesRef.current = linkIndices;

        setHighlightNodeIds(new Set(nodeIds));
        setHighlightLinkIndices(new Set(linkIndices));
        // Force re-render of all nodes to update highlight states
        graph.nodeThreeObject(graph.nodeThreeObject());
        graph.refresh();

        const distance = 200;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio + 30, z: node.z * distRatio + 40 },
          { x: node.x, y: node.y, z: node.z },
          900
        );
      })
      .onNodeDrag((node) => {
        if (node._layerZ !== undefined) {
          node.z  = node._layerZ;
          node.fz = node._layerZ;
          node.vz = 0;
        }
      })
      .onNodeDragEnd((node) => {
        node.fx = undefined;
        node.fy = undefined;
        if (node._layerZ !== undefined) {
          node.z  = node._layerZ;
          node.fz = node._layerZ;
          node.vz = 0;
        }
        graph.d3ReheatSimulation();
      })
      .onBackgroundClick(() => {
        if (flyActiveRef.current) return; // fly mode owns clicks

        selectedNodeIdRef.current = null;
        highlightNodeIdsRef.current = new Set();
        highlightLinkIndicesRef.current = new Set();

        setHighlightNodeIds(new Set());
        setHighlightLinkIndices(new Set());
        // Force re-render of all nodes to clear highlights
        graph.nodeThreeObject(graph.nodeThreeObject());
        graph.refresh();

        if (onNodeSelect) onNodeSelect(null);
      });

    // ── Scene references ──
    const scene    = graph.scene();
    const renderer = graph.renderer();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    // ── Stage dimensions ──
    const stageWidth = 900;
    const stageDepth = Math.max(700, config.layerSpacing * 5);
    const floorY     = -220;
    const backWallZ  = -stageDepth / 2;

    // ── Stage geometry constants (reused in forces + tick) ──
    const xLimit = stageWidth / 2 - 60;   // soft-wall x boundary (with margin)
    const yMax   =  180;                   // ceiling
    const yMin   = floorY + 30;            // just above floor

    // ─── Floor ───────────────────────────────────────────────
    const floorGeometry = new THREE.PlaneGeometry(stageWidth, stageDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: '#303946', roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, floorY, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // ─── Back wall ───────────────────────────────────────────
    const wallGeometry = new THREE.PlaneGeometry(stageWidth, 520);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: '#202938', roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide,
    });
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, floorY + 260, backWallZ);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // ─── Side wall (completes the stage corner, per the paper) ──
    const sideWallGeometry = new THREE.PlaneGeometry(stageDepth, 520);
    const sideWallMaterial = new THREE.MeshStandardMaterial({
      color: '#1e2a38', roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide,
    });
    const sideWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-(stageWidth / 2), floorY + 260, 0);
    sideWall.receiveShadow = true;
    scene.add(sideWall);

    // ─── Lighting ─────────────────────────────────────────────
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(250, 500, 350);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width  = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left   = -700;
    directionalLight.shadow.camera.right  =  700;
    directionalLight.shadow.camera.top    =  700;
    directionalLight.shadow.camera.bottom = -700;
    directionalLight.shadow.camera.near   = 1;
    directionalLight.shadow.camera.far    = 1500;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // ─── Shadow projections (floor + back wall + side wall) ──
    // One InstancedMesh per surface — updated every tick (no Z-fighting because
    // each mesh is parked at its surface with a tiny epsilon offset).
    const nodeCount  = filteredGraphData.nodes.length;
    const shadowGeo  = new THREE.CircleGeometry(6, 16);
    const shadowMat  = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.30, depthWrite: false,
    });

    // Floor shadows  — lie flat on the floor (circle already in XY, rotate to XZ)
    const floorShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, nodeCount);
    floorShadows.rotation.x = -Math.PI / 2;
    floorShadows.position.y = floorY + 0.5;          // epsilon above floor
    floorShadows.renderOrder = 1;
    scene.add(floorShadows);

    // Back-wall shadows — stand upright on the back wall
    const backWallShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, nodeCount);
    backWallShadows.position.z = backWallZ + 0.5;    // epsilon in front of wall
    backWallShadows.renderOrder = 1;
    scene.add(backWallShadows);

    // Side-wall shadows — rotate to face the side wall
    const sideWallShadows = new THREE.InstancedMesh(shadowGeo, shadowMat, nodeCount);
    sideWallShadows.rotation.y = Math.PI / 2;
    sideWallShadows.position.x = -(stageWidth / 2) + 0.5;  // epsilon in front of wall
    sideWallShadows.renderOrder = 1;
    scene.add(sideWallShadows);

    const _dummy = new THREE.Object3D();

    // ── Disable all default d3 forces ──
    graph.d3Force('charge', null);
    graph.d3Force('link',   null);
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

    // ── Custom Force 3: Soft wall boundary repulsion ──
    // Smoothly decelerates nodes as they approach stage edges so they never
    // drift outside the visible floor/wall surfaces.
    const wallRepulsion = (() => {
      const k = 1.2; // stiffness — increase if nodes still escape at high repulsion

      return (alpha) => {
        for (const node of filteredGraphData.nodes) {
          if (node.x >  xLimit) node.vx -= (node.x -  xLimit) * k * alpha;
          if (node.x < -xLimit) node.vx += (-xLimit - node.x) * k * alpha;
          if (node.y >  yMax)   node.vy -= (node.y -  yMax)   * k * alpha;
          if (node.y <  yMin)   node.vy += (yMin   - node.y)  * k * alpha;
        }
      };
    })();
    graph.d3Force('wallRepulsion', wallRepulsion);

    // ── Simulation damping ──
    graph.d3VelocityDecay(config.damping);

    // ── Initial node positions: random x/y (FREE), z locked to layer ──
    const layers  = filteredGraphData.nodes.map((n) => n.layer !== undefined ? n.layer : 0);
    const midLayer = (Math.min(...layers) + Math.max(...layers)) / 2;

    for (const node of filteredGraphData.nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - midLayer) * layerSpacing;

      node.z       = exactZ;
      node.fz      = exactZ;
      node.vz      = 0;
      node._layerZ = exactZ;

      if (node.x === undefined) node.x = (Math.random() - 0.5) * 200;
      if (node.y === undefined) node.y = (Math.random() - 0.5) * 200;
    }

    // ── Resolve link node references for line drawing ──
    const nodeById = new Map();
    for (const node of filteredGraphData.nodes) nodeById.set(node.id, node);

    const linkPairs = [];
    for (const link of filteredGraphData.links) {
      const src = typeof link.source === 'object' ? link.source : nodeById.get(link.source);
      const tgt = typeof link.target === 'object' ? link.target : nodeById.get(link.target);
      if (src && tgt) linkPairs.push(src, tgt);
    }

    const totalSegments = linkPairs.length / 2;

    // ── Feed data to graph ──
    graph.graphData({
      nodes: graphData.nodes || [],
      links: graphData.links || [],
    });

    // ── Build fat LineSegments2 for actual spring links ──
    const posArray = new Float32Array(totalSegments * 6); // 2 vertices × 3 components
    const colorArray = new Float32Array(totalSegments * 6); // per-vertex colors for highlight/dim
    for (let s = 0; s < totalSegments; s++) {
      const src = linkPairs[s * 2];
      const tgt = linkPairs[s * 2 + 1];
      posArray[s * 6] = src.x; posArray[s * 6 + 1] = src.y; posArray[s * 6 + 2] = src.z;
      posArray[s * 6 + 3] = tgt.x; posArray[s * 6 + 4] = tgt.y; posArray[s * 6 + 5] = tgt.z;
      colorArray[s * 6] = 0.4;
      colorArray[s * 6 + 1] = 0.6;
      colorArray[s * 6 + 2] = 1.0;
      colorArray[s * 6 + 3] = 0.4;
      colorArray[s * 6 + 4] = 0.6;
      colorArray[s * 6 + 5] = 1.0;
    }

    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(posArray);
    lineGeometry.setColors(colorArray);

    const size = new THREE.Vector2();
    renderer.getSize(size);

    const lineMaterial = new LineMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.9,
      linewidth: 4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      resolution: size,
      vertexColors: true,
    });

    const lineSegments = new LineSegments2(lineGeometry, lineMaterial);
    graph.scene().add(lineSegments);
    linksRef.current = { lineSegments, lineGeometry, lineMaterial, linkPairs, posArray };

    // ── Per-tick update: z-lock + hard x/y clamp + links + shadow projections ──
    graph.onEngineTick(() => {
      for (const node of filteredGraphData.nodes) {
        // Belt-and-suspenders z-lock (catches any fp drift from fz)
        if (node._layerZ !== undefined) {
          node.z  = node._layerZ;
          node.vz = 0;
        }

        // Hard x/y clamp — last line of defence after soft wall force
        if (node.x >  xLimit) { node.x =  xLimit; node.vx = 0; }
        if (node.x < -xLimit) { node.x = -xLimit; node.vx = 0; }
        if (node.y >  yMax)   { node.y =  yMax;   node.vy = 0; }
        if (node.y <  yMin)   { node.y =  yMin;   node.vy = 0; }
      }

      // Update link line positions
      if (linksRef.current) {
        const { linkPairs: pairs, posArray: pos } = linksRef.current;
        const segs = pairs.length / 2;

        for (let s = 0; s < segs; s++) {
          const src = pairs[s * 2];
          const tgt = pairs[s * 2 + 1];
          pos[s * 6] = src.x; pos[s * 6 + 1] = src.y; pos[s * 6 + 2] = src.z;
          pos[s * 6 + 3] = tgt.x; pos[s * 6 + 4] = tgt.y; pos[s * 6 + 5] = tgt.z;
        }
        linksRef.current.lineGeometry.setPositions(pos);
        const color = colorArray;

        for (let s = 0; s < segs; s++) {
          const activeLinkIndices = highlightLinkIndicesRef.current;

          const isActive =
            activeLinkIndices.size === 0 || activeLinkIndices.has(s);

          const r = isActive ? 0.2 : 0.02;
          const g = isActive ? 0.9 : 0.02;
          const b = isActive ? 1.0 : 0.02;

          color[s * 6] = r;
          color[s * 6 + 1] = g;
          color[s * 6 + 2] = b;
          color[s * 6 + 3] = r;
          color[s * 6 + 4] = g;
          color[s * 6 + 5] = b;
        }

        linksRef.current.lineGeometry.setColors(color);
      }

      // ── Shadow projections (UIST '92 stage metaphor) ──
      // Each node casts an orthographic projection onto floor, back wall, side wall.
      // The InstancedMesh for each surface is already translated/rotated to sit at
      // the correct plane — we only need to supply x/y offsets within that plane.
      filteredGraphData.nodes.forEach((node, i) => {
        const s = 0.5 + (node.weight || 10) / 50;

        // Floor shadow: drop onto XZ plane (position is in the mesh's local XY
        // which, after the -90° X rotation, maps to world XZ)
        _dummy.position.set(node.x, node.z, 0);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        floorShadows.setMatrixAt(i, _dummy.matrix);

        // Back-wall shadow: project onto XY plane at z = backWallZ
        // Local position is just (x, y) — the mesh already sits at backWallZ
        _dummy.position.set(node.x, node.y - floorY - 260, 0);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        backWallShadows.setMatrixAt(i, _dummy.matrix);

        // Side-wall shadow: project onto YZ plane at x = -(stageWidth/2)
        // After the 90° Y rotation, local X→world Z, local Y→world Y
        _dummy.position.set(node.z, node.y - floorY - 260, 0);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        sideWallShadows.setMatrixAt(i, _dummy.matrix);
      });

      floorShadows.instanceMatrix.needsUpdate    = true;
      backWallShadows.instanceMatrix.needsUpdate = true;
      sideWallShadows.instanceMatrix.needsUpdate = true;
    });

    // ── Initial camera position ──
    setTimeout(() => {
      graph.cameraPosition({ x: 0, y: 80, z: 700 }, { x: 0, y: 0, z: 0 }, 0);
    }, 100);

    graphRef.current = graph;

    // ── Cleanup ──
    return () => {
      scene.remove(floor, backWall, sideWall);
      scene.remove(directionalLight, ambientLight);
      scene.remove(floorShadows, backWallShadows, sideWallShadows);

      floorGeometry.dispose();    floorMaterial.dispose();
      wallGeometry.dispose();     wallMaterial.dispose();
      sideWallGeometry.dispose(); sideWallMaterial.dispose();
      shadowGeo.dispose();        shadowMat.dispose();

      if (linksRef.current) {
        scene.remove(linksRef.current.lineSegments);
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

    if (repulsionRef.current) {
      repulsionRef.current.strength(config.repulsionStrength);
      repulsionRef.current.maxDistance(config.repulsionMaxDistance);
    }
    if (springRef.current) {
      springRef.current.strength(config.springStrength);
      springRef.current.restLength(config.springRestLength);
    }

    graph.d3VelocityDecay(config.damping);
    graph.d3ReheatSimulation();
  }, [
    config.repulsionStrength,
    config.repulsionMaxDistance,
    config.springStrength,
    config.springRestLength,
    config.damping,
  ]);

  // ── Update layer Z positions when layerSpacing changes ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const nodes = graph.graphData().nodes;
    const ls    = nodes.map((n) => (n.layer !== undefined ? n.layer : 0));
    const mid   = (Math.min(...ls) + Math.max(...ls)) / 2;

    for (const node of nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - mid) * config.layerSpacing;
      node.z       = exactZ;
      node.fz      = exactZ;
      node.vz      = 0;
      node._layerZ = exactZ;
    }

    graph.d3ReheatSimulation();
  }, [config.layerSpacing]);

  // ── Reset view ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.cameraPosition(
      { x: 0, y: 80, z: 700 },
      { x: 0, y: 0,  z: 0   },
      800
    );
  }, [resetViewTrigger, filteredGraphData]);

  // ── Window resize ──
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.width(containerRef.current.clientWidth);
        graphRef.current.height(containerRef.current.clientHeight);

        if (linksRef.current?.lineMaterial) {
          const sz = new THREE.Vector2();
          graphRef.current.renderer().getSize(sz);
          linksRef.current.lineMaterial.resolution.set(sz.x, sz.y);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <FlyCamera
        graphRef={graphRef}
        flyActiveRef={flyActiveRef}
        containerRef={containerRef}
      />
    </div>
  );
}