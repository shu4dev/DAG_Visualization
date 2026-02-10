/**
 * Physics simulation types for force-directed layout
 */

import type { Vector3D } from './graph'

export interface PhysicsConfig {
  repulsionStrength: number
  repulsionRange: number
  springStiffness: number
  springRestLength: number
  anchorStrength: number
  dampingFactor: number
  timeStep: number
  maxIterations: number
  convergenceThreshold: number
}

export interface Particle {
  id: string
  position: Vector3D
  velocity: Vector3D
  force: Vector3D
  mass: number
  fixed: boolean
  layerIndex: number
}

export interface Force {
  apply(particles: Particle[]): void
  reset(): void
}

export interface SimulationState {
  particles: Particle[]
  iteration: number
  converged: boolean
  energy: number
}
