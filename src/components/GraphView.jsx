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

// Read scene-color CSS variables — single source of truth for both themes.
const readSceneColors = () => {
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: get('--scene-bg'),
    floor: get('--scene-floor'),
    backWall: get('--scene-back-wall'),
    sideWall: get('--scene-side-wall'),
    link: get('--scene-link'),
    shadow: get('--scene-shadow'),
    shadowOpacity: parseFloat(get('--scene-shadow-opacity')) || 0.3,
    spriteText: get('--scene-sprite-text'),
    spriteBg: get('--scene-sprite-bg'),
    spriteBgDim: get('--scene-sprite-bg-dim'),
  };
};

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
  theme,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const linksRef = useRef(null);
  const repulsionRef = useRef(null);
  const springRef = useRef(null);
  const configRef = useRef(config);
  const selectedNodeIdRef = useRef(null);
  const highlightNodeIdsRef = useRef(new Set());
  const highlightLinkIndicesRef = useRef(new Set());

  // Layer planes (one translucent disc per distinct _layerZ)
  const layerPlanesRef = useRef([]);
  const rebuildLayerPlanesRef = useRef(null);
  const floorMatRef = useRef(null);
  const backWallMatRef = useRef(null);
  const sideWallMatRef = useRef(null);
  const shadowMatRef = useRef(null);
  // Map<nodeId, SpriteText> — re-renders overwrite the entry, no stale refs.
  const spritesRef = useRef(new Map());
  // Mirror of theme prop so the nodeThreeObject closure sees fresh values.
  const themeRef = useRef(theme);

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

    spritesRef.current = new Map();
    const initialColors = readSceneColors();

    const graph = ForceGraph3D()(containerRef.current)
      .backgroundColor(initialColors.bg)
      .showNavInfo(false)
      .linkOpacity(0) // we'll draw custom lines, so hide the built-in ones

      // ── Node rendering (fully custom hologram) ──
      .nodeThreeObjectExtend(false)
      .nodeThreeObject((node) => {
        const isSelected = selectedNodeIdRef.current === node.id;
        const highlightSet = highlightNodeIdsRef.current;
        const isDimmed = highlightSet.size > 0 && !highlightSet.has(node.id);

        const group = createHologramNode({
          ...node,
          isSelected,
          isDimmed,
          theme: themeRef.current,
        });

        group.traverse((child) => {
          if (child.isMesh) child.castShadow = true;
        });

        const s = 0.5 + (node.weight || 10) / 50;
        const outerRadius = 8.5 * s;

        const spriteColors = readSceneColors();
        const sprite = new SpriteText(node.label || node.id);
        sprite.color = spriteColors.spriteText;
        sprite.textHeight = Math.max(2.5, outerRadius * 0.25);
        sprite.position.y = outerRadius + 3;
        sprite.fontFace = 'DM Sans, sans-serif';
        sprite.backgroundColor = isSelected
          ? spriteColors.spriteBg
          : spriteColors.spriteBgDim;
        sprite.padding = isSelected ? 2.5 : 1.5;
        sprite.borderRadius = 3;
        sprite.userData.selected = isSelected;
        spritesRef.current.set(node.id, sprite);
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
          node.z = node._layerZ;
          node.fz = node._layerZ;
          node.vz = 0;
        }
      })
      .onNodeDragEnd((node) => {
        node.fx = undefined;
        node.fy = undefined;
        if (node._layerZ !== undefined) {
          node.z = node._layerZ;
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
    const scene = graph.scene();
    const renderer = graph.renderer();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ── Stage dimensions ──
    const stageWidth = 900;
    const stageDepth = Math.max(700, config.layerSpacing * 5);
    const floorY = -220;
    const backWallZ = -stageDepth / 2;

    // ── Stage geometry constants (reused in forces + tick) ──
    const xLimit = stageWidth / 2 - 60;   // soft-wall x boundary (with margin)
    const yMax = 180;                   // ceiling
    const yMin = floorY + 30;            // just above floor

    // ─── Floor ───────────────────────────────────────────────
    const floorGeometry = new THREE.PlaneGeometry(stageWidth, stageDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: initialColors.floor, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide,
    });
    floorMatRef.current = floorMaterial;
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, floorY, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // ─── Back wall ───────────────────────────────────────────
    const wallGeometry = new THREE.PlaneGeometry(stageWidth, 520);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: initialColors.backWall, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide,
    });
    backWallMatRef.current = wallMaterial;
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, floorY + 260, backWallZ);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // ─── Side wall (completes the stage corner, per the paper) ──
    const sideWallGeometry = new THREE.PlaneGeometry(stageDepth, 520);
    const sideWallMaterial = new THREE.MeshStandardMaterial({
      color: initialColors.sideWall, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide,
    });
    sideWallMatRef.current = sideWallMaterial;
    const sideWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(-(stageWidth / 2), floorY + 260, 0);
    sideWall.receiveShadow = true;
    scene.add(sideWall);

    // ─── Lighting ─────────────────────────────────────────────
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(250, 500, 350);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -700;
    directionalLight.shadow.camera.right = 700;
    directionalLight.shadow.camera.top = 700;
    directionalLight.shadow.camera.bottom = -700;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 1500;
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // ─── Shadow projections (floor + back wall + side wall) ──
    // One InstancedMesh per surface — updated every tick (no Z-fighting because
    // each mesh is parked at its surface with a tiny epsilon offset).
    const nodeCount = filteredGraphData.nodes.length;
    const shadowGeo = new THREE.CircleGeometry(6, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: initialColors.shadow,
      transparent: true,
      opacity: initialColors.shadowOpacity,
      depthWrite: false,
    });
    shadowMatRef.current = shadowMat;

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

    // ── Custom Force 3: Soft wall boundary repulsion ──
    // Smoothly decelerates nodes as they approach stage edges so they never
    // drift outside the visible floor/wall surfaces.
    const wallRepulsion = (() => {
      const k = 1.2; // stiffness — increase if nodes still escape at high repulsion

      return (alpha) => {
        for (const node of filteredGraphData.nodes) {
          if (node.x > xLimit) node.vx -= (node.x - xLimit) * k * alpha;
          if (node.x < -xLimit) node.vx += (-xLimit - node.x) * k * alpha;
          if (node.y > yMax) node.vy -= (node.y - yMax) * k * alpha;
          if (node.y < yMin) node.vy += (yMin - node.y) * k * alpha;
        }
      };
    })();
    graph.d3Force('wallRepulsion', wallRepulsion);

    // ── Simulation damping ──
    graph.d3VelocityDecay(config.damping);

    // ── Initial node positions: random x/y (FREE), z locked to layer ──
    const layers = filteredGraphData.nodes.map((n) => n.layer !== undefined ? n.layer : 0);
    const midLayer = (Math.min(...layers) + Math.max(...layers)) / 2;

    for (const node of filteredGraphData.nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - midLayer) * layerSpacing;

      node.z = exactZ;
      node.fz = exactZ;
      node.vz = 0;
      node._layerZ = exactZ;

      if (node.x === undefined) node.x = (Math.random() - 0.5) * 200;
      if (node.y === undefined) node.y = (Math.random() - 0.5) * 200;
    }

    // ─── Layer planes ────────────────────────────────────────────────────
    // One thin translucent rectangle per distinct _layerZ, sized to the full
    // stage soft-wall bounds so it reaches the furthest possible node from
    // the moment it loads (no waiting for the simulation to settle).
    // Rebuilt on dataset change and on layer-spacing change.
    // `depthWrite: false` + `renderOrder: -1` keeps lower planes visible
    // through upper ones and lets the additive-blended link lines show
    // through every plane.
    function rebuildLayerPlanes() {
      // Tear down old planes
      for (const item of layerPlanesRef.current) {
        scene.remove(item.plane);
        scene.remove(item.edges);
        item.plane.geometry.dispose();
        item.plane.material.dispose();
        item.edges.geometry.dispose();
        item.edges.material.dispose();
      }
      layerPlanesRef.current = [];

      // Group nodes by _layerZ — one plane per distinct value
      const layerGroups = new Map();
      for (const node of filteredGraphData.nodes) {
        const z = node._layerZ;
        if (z === undefined) continue;
        if (!layerGroups.has(z)) layerGroups.set(z, []);
        layerGroups.get(z).push(node);
      }

      // Plane size = stage soft-wall bounds + small padding so the plane
      // reaches the furthest possible node position from the moment it
      // appears.  This avoids the "plane is a tiny square until physics
      // settles" effect on JSON load.  All layers share the same footprint,
      // matching the "physical floors of a building" metaphor.
      const padding = 40;
      const planeWidth  = (xLimit * 2) + padding * 2;
      const planeHeight = (yMax - yMin) + padding * 2;
      const planeCY     = (yMax + yMin) / 2;        // centre vertically between yMin and yMax
      const visible = configRef.current.showLayerPlanes !== false;

      for (const [z] of layerGroups) {
        // Plane mesh — flat in XY, normal along Z (matches layer orientation)
        const planeGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const planeMat = new THREE.MeshStandardMaterial({
          color:       0x60a5fa,            // matches link tint
          transparent: true,
          opacity:     0.10,
          depthWrite:  false,                // lower planes & links show through
          side:        THREE.DoubleSide,     // visible from above and below
          roughness:   0.9,
          metalness:   0.0,
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.position.set(0, planeCY, z);
        plane.receiveShadow = true;          // nodes drop shadows onto plane
        plane.renderOrder   = -1;            // draw before nodes/links
        plane.visible       = visible;
        scene.add(plane);

        // Subtle border ring for legibility
        const edgesGeo = new THREE.EdgesGeometry(planeGeo);
        const edgesMat = new THREE.LineBasicMaterial({
          color:       0x60a5fa,
          transparent: true,
          opacity:     0.35,
          depthWrite:  false,
        });
        const edges = new THREE.LineSegments(edgesGeo, edgesMat);
        edges.position.copy(plane.position);
        edges.renderOrder = -1;
        edges.visible     = visible;
        scene.add(edges);

        layerPlanesRef.current.push({ plane, edges, z });
      }
    }
    rebuildLayerPlanesRef.current = rebuildLayerPlanes;
    rebuildLayerPlanes(); // initial build — uses stage bounds, so it's already at full size

    // ── Resolve link node references for line drawing ──
    const nodeById = new Map();
    for (const node of filteredGraphData.nodes) nodeById.set(node.id, node);

    const linkPairs = [];
    const linkValues = [];
    for (const link of filteredGraphData.links) {
      const src = typeof link.source === 'object' ? link.source : nodeById.get(link.source);
      const tgt = typeof link.target === 'object' ? link.target : nodeById.get(link.target);

      if (src && tgt) {
        linkPairs.push(src, tgt);
        linkValues.push(Number(link.value ?? 1));
      }
    }

    const minLinkValue = Math.min(...linkValues);
    const maxLinkValue = Math.max(...linkValues);

    console.log('Link value range:', {
      minLinkValue,
      maxLinkValue,
      sampleValues: linkValues.slice(0, 10),
    });
    // Normalizes a link value to [0, 1] based on the min/max in the dataset
    const normalizeLinkValue = (value) => {
      if (maxLinkValue === minLinkValue) return 1;
      return (value - minLinkValue) / (maxLinkValue - minLinkValue);
    };

    const mapRange = (value, outMin, outMax) => {
      return outMin + value * (outMax - outMin);
    };

    const getLinkWidth = (value) => {
      const normalized = normalizeLinkValue(value);
      return mapRange(normalized, 1, 5);
    };

    const getLinkOpacity = (value) => {
      const normalized = normalizeLinkValue(value);
      return mapRange(normalized, 0.15, 0.8);
    };

    const getLinkVisibility = (value, isActive, hasSelection) => {
      const weightedOpacity = getLinkOpacity(value);

      if (!hasSelection) return weightedOpacity;
      if (isActive) return Math.max(weightedOpacity, 0.9);
      return Math.min(weightedOpacity * 0.08, 0.06);
    };
    console.log('Mapped link values:', linkValues.slice(0, 10).map((value) => ({
      value,
      width: getLinkWidth(value),
      opacity: getLinkOpacity(value),
    })));
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
      const value = linkValues[s] ?? 1;

      const opacity = getLinkVisibility(value, true, false);

      // Grayscale vertex colors (r=g=b=opacity). LineMaterial.color drives hue,
      // so theme changes can recolor links without rewriting per-vertex data.
      posArray[s * 6] = src.x; posArray[s * 6 + 1] = src.y; posArray[s * 6 + 2] = src.z;
      posArray[s * 6 + 3] = tgt.x; posArray[s * 6 + 4] = tgt.y; posArray[s * 6 + 5] = tgt.z;
      colorArray[s * 6] = opacity;
      colorArray[s * 6 + 1] = opacity;
      colorArray[s * 6 + 2] = opacity;
      colorArray[s * 6 + 3] = opacity;
      colorArray[s * 6 + 4] = opacity;
      colorArray[s * 6 + 5] = opacity;
    }

    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(posArray);
    lineGeometry.setColors(colorArray);

    const size = new THREE.Vector2();
    renderer.getSize(size);

    const lineMaterial = new LineMaterial({
      color: initialColors.link,
      transparent: true,
      opacity: 0.9,
      linewidth: 4,
      depthWrite: false,
      // AdditiveBlending pops on dark bg but vanishes on light — switch per theme.
      blending: theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending,
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
          node.z = node._layerZ;
          node.vz = 0;
        }

        // Hard x/y clamp — last line of defence after soft wall force
        if (node.x > xLimit) { node.x = xLimit; node.vx = 0; }
        if (node.x < -xLimit) { node.x = -xLimit; node.vx = 0; }
        if (node.y > yMax) { node.y = yMax; node.vy = 0; }
        if (node.y < yMin) { node.y = yMin; node.vy = 0; }
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

          const hasSelection = activeLinkIndices.size > 0;
          const isActive = !hasSelection || activeLinkIndices.has(s);

          const value = linkValues[s];
          const opacity = getLinkVisibility(value, isActive, hasSelection);

          // Grayscale per-vertex (opacity-only) — LineMaterial.color drives hue.
          color[s * 6] = opacity;
          color[s * 6 + 1] = opacity;
          color[s * 6 + 2] = opacity;
          color[s * 6 + 3] = opacity;
          color[s * 6 + 4] = opacity;
          color[s * 6 + 5] = opacity;
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

      floorShadows.instanceMatrix.needsUpdate = true;
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

      floorGeometry.dispose(); floorMaterial.dispose();
      wallGeometry.dispose(); wallMaterial.dispose();
      sideWallGeometry.dispose(); sideWallMaterial.dispose();
      shadowGeo.dispose(); shadowMat.dispose();

      // Dispose layer planes
      for (const item of layerPlanesRef.current) {
        scene.remove(item.plane);
        scene.remove(item.edges);
        item.plane.geometry.dispose();
        item.plane.material.dispose();
        item.edges.geometry.dispose();
        item.edges.material.dispose();
      }
      layerPlanesRef.current = [];
      rebuildLayerPlanesRef.current = null;

      if (linksRef.current) {
        scene.remove(linksRef.current.lineSegments);
        linksRef.current.lineGeometry.dispose();
        linksRef.current.lineMaterial.dispose();
        linksRef.current = null;
      }

      graph._destructor && graph._destructor();
    };
  }, [filteredGraphData, onNodeSelect]);

  // ── Theme change: mutate scene materials in place (no scene rebuild) ──
  useEffect(() => {
    themeRef.current = theme;
    const graph = graphRef.current;
    if (!graph) return;

    const c = readSceneColors();
    graph.backgroundColor(c.bg);
    floorMatRef.current?.color.set(c.floor);
    backWallMatRef.current?.color.set(c.backWall);
    sideWallMatRef.current?.color.set(c.sideWall);
    if (shadowMatRef.current) {
      shadowMatRef.current.color.set(c.shadow);
      shadowMatRef.current.opacity = c.shadowOpacity;
    }
    if (linksRef.current?.lineMaterial) {
      linksRef.current.lineMaterial.color.set(c.link);
      linksRef.current.lineMaterial.blending =
        theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending;
      linksRef.current.lineMaterial.needsUpdate = true;
    }
    spritesRef.current.forEach((sprite) => {
      sprite.color = c.spriteText;
      sprite.backgroundColor = sprite.userData.selected
        ? c.spriteBg
        : c.spriteBgDim;
      // Force the sprite's internal canvas to redraw with the new colors.
      if (sprite.material?.map) sprite.material.map.needsUpdate = true;
    });

    // Force every node to be rebuilt by createHologramNode so it picks up
    // the new theme (different blending modes / emissive intensity / hue).
    graph.nodeThreeObject(graph.nodeThreeObject());
    graph.refresh();
  }, [theme]);

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
    const ls = nodes.map((n) => (n.layer !== undefined ? n.layer : 0));
    const mid = (Math.min(...ls) + Math.max(...ls)) / 2;

    for (const node of nodes) {
      const exactZ = ((node.layer !== undefined ? node.layer : 0) - mid) * config.layerSpacing;
      node.z = exactZ;
      node.fz = exactZ;
      node.vz = 0;
      node._layerZ = exactZ;
    }

    // Snap planes to new Z immediately (don't wait for simulation to re-settle)
    rebuildLayerPlanesRef.current?.();

    graph.d3ReheatSimulation();
  }, [config.layerSpacing]);

  // ── Toggle layer-plane visibility ──
  useEffect(() => {
    const visible = config.showLayerPlanes !== false; // default ON
    for (const item of layerPlanesRef.current) {
      item.plane.visible = visible;
      item.edges.visible = visible;
    }
  }, [config.showLayerPlanes]);

  // ── Reset view ──
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.cameraPosition(
      { x: 0, y: 80, z: 700 },
      { x: 0, y: 0, z: 0 },
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