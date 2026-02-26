/**
 * Custom Force Functions for Layered DAG Layout
 *
 * These forces work with d3-force-3d (used internally by 3d-force-graph)
 * to implement the layered DAG physics described in the project spec:
 * 
 * 1. Layer anchoring: nodes are attracted to their layer plane along the Z axis
 * 2. Within-layer repulsion: nodes in the same layer repel each other (X/Y only)
 * 3. Spring edges: handled by default d3 link force (edges pull connected nodes)
 * 4. Damping: controlled via d3's alpha decay
 */

/**
 * Force that anchors nodes to their assigned layer plane along the Z axis.
 * Each layer is positioned at z = layerIndex * layerSpacing.
 *
 * @param {number} strength - How strongly nodes are pulled to their layer plane (0-1)
 * @param {number} layerSpacing - Distance between layer planes in world units
 */
export function forceLayerAnchor(strength = 0.5, layerSpacing = 100) {
  let nodes;

  function force() {
    for (const node of nodes) {
      if (node.layer === undefined) continue;
      const targetZ = node.layer * layerSpacing;
      // Hard-lock node to its layer plane on the Z axis
      node.z = targetZ;
      node.vz = 0;
    }
  }

  force.initialize = function (_nodes) {
    nodes = _nodes;
    // Set initial Z positions to layer planes
    for (const node of nodes) {
      if (node.layer !== undefined) {
        node.z = node.layer * layerSpacing;
      }
    }
  };

  // Allow updating strength at runtime (for slider controls)
  force.strength = function (s) {
    if (s === undefined) return strength;
    strength = s;
    return force;
  };

  force.layerSpacing = function (s) {
    if (s === undefined) return layerSpacing;
    layerSpacing = s;
    return force;
  };

  return force;
}

/**
 * Force that provides extra repulsion between nodes in the SAME layer.
 * Only affects X and Y, leaving Z controlled by layer anchoring.
 *
 * @param {number} strength - Repulsion strength (negative = repel)
 * @param {number} maxDistance - Max distance at which repulsion applies
 */
export function forceWithinLayerRepulsion(strength = -50, maxDistance = 150) {
  let nodes;

  function force(alpha) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        // Only apply within same layer
        if (a.layer !== b.layer) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist > maxDistance) continue;

        // Coulomb-like repulsion: F = strength / dist^2
        const forceMag = (strength * alpha) / (dist * dist);
        const fx = (dx / dist) * forceMag;
        const fy = (dy / dist) * forceMag;

        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  force.initialize = function (_nodes) {
    nodes = _nodes;
  };

  force.strength = function (s) {
    if (s === undefined) return strength;
    strength = s;
    return force;
  };

  force.maxDistance = function (d) {
    if (d === undefined) return maxDistance;
    maxDistance = d;
    return force;
  };

  return force;
}
