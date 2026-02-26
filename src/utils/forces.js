/**
 * Within-layer position-based repulsion for d3-force.
 *
 * Apple Watch bubble UI pattern: when a node is dragged, nearby same-layer
 * nodes are pushed away so force fields don't overlap. Displacement is
 * applied directly via fx/fy (not velocity), so nodes slide smoothly.
 * On release, GraphView animates displaced nodes back to their _homeX/_homeY.
 *
 * @param {number} strength - Unused (kept for API compat with config)
 * @param {number} maxDistance - Scales the effective repulsion radius
 */
export function forceWithinLayerRepulsion(strength = -30, maxDistance = 150) {
  let nodes;

  function force(/* alpha */) {
    // Find the actively-dragged node (unpinned: fx === undefined)
    const dragged = nodes.find(n => n.fx === undefined && n.fy === undefined);
    if (!dragged) return;

    const dragLayer = dragged.layer;

    for (const node of nodes) {
      if (node === dragged) continue;
      if (node.layer !== dragLayer) continue;
      if (node._homeX === undefined) continue;

      const dx = node._homeX - dragged.x;
      const dy = node._homeY - dragged.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Minimum separation = sum of both nodes' effective radii
      // nodeRelSize(0.3) × cbrt(100 + w²) gives visual radius;
      // scale by maxDistance/50 to tie repulsion range to the config slider
      const radiusA = 0.3 * Math.cbrt(100 + Math.pow(dragged.weight || 10, 2));
      const radiusB = 0.3 * Math.cbrt(100 + Math.pow(node.weight || 10, 2));
      const minSep = (radiusA + radiusB) * maxDistance / 50;

      if (dist >= minSep) {
        // No overlap — snap back to home
        node.fx = node._homeX;
        node.fy = node._homeY;
        continue;
      }

      // Push away: displace along the vector from dragged → node
      const overlap = minSep - dist;
      const pushX = (dx / dist) * overlap;
      const pushY = (dy / dist) * overlap;
      node.fx = node._homeX + pushX;
      node.fy = node._homeY + pushY;
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
