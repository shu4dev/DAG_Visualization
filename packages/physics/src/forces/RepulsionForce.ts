/**
 * Repulsion force between nodes in the same layer
 */

import type { Force, Particle } from '@dag-viz/types'
import { Vector3D } from '@dag-viz/utils'

export class RepulsionForce implements Force {
  private strength: number
  private range: number

  constructor(strength: number, range: number) {
    this.strength = strength
    this.range = range
  }

  apply(particles: Particle[]): void {
    // Apply repulsion only between particles in the same layer
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i]
        const p2 = particles[j]

        // Only repel nodes in the same layer
        if (p1.layerIndex !== p2.layerIndex) continue

        const distance = Vector3D.distance(p1.position, p2.position)

        // Only apply repulsion within range
        if (distance > this.range || distance < 0.01) continue

        const direction = Vector3D.normalize(Vector3D.subtract(p1.position, p2.position))
        const forceMagnitude = this.strength / (distance * distance)

        const force = Vector3D.multiply(direction, forceMagnitude)

        // Apply force to both particles (Newton's third law)
        p1.force = Vector3D.add(p1.force, force)
        p2.force = Vector3D.subtract(p2.force, force)
      }
    }
  }

  reset(): void {
    // No state to reset for this force
  }
}
