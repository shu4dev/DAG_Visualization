import { useState, useCallback } from 'react';

/**
 * Hook to manage force simulation parameters.
 * Provides current values and setters for all tunable forces.
 */
export function useForceConfig() {
  const [config, setConfig] = useState({
    // Layer anchoring
    layerStrength: 0.5,
    layerSpacing: 120,

    // Within-layer repulsion
    repulsionStrength: -60,
    repulsionMaxDistance: 150,

    // Simulation damping
    alphaDecay: 0.02,
    velocityDecay: 0.4,

    // Visual
    nodeScale: 1.0,
    showLabels: true,
    showLayerPlanes: true,
    showLinks: true,
    showForceField: false,
  });

  const updateConfig = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { config, updateConfig };
}
