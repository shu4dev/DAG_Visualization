/**
 * Main physics simulation engine for force-directed layout
 */

import type { PhysicsConfig, Particle, Force } from '@dag-viz/types'

export class PhysicsSimulation {
  private config: PhysicsConfig
  private particles: Particle[]
  private forces: Force[]
  private iteration: number
  private converged: boolean

  constructor(config: PhysicsConfig) {
    this.config = config
    this.particles = []
    this.forces = []
    this.iteration = 0
    this.converged = false
  }

  setParticles(particles: Particle[]): void {
    this.particles = particles
    this.iteration = 0
    this.converged = false
  }

  addForce(force: Force): void {
    this.forces.push(force)
  }

  step(): void {
    if (this.converged) return

    // Reset forces
    for (const force of this.forces) {
      force.reset()
    }

    // Apply all forces
    for (const force of this.forces) {
      force.apply(this.particles)
    }

    // Integrate (update positions and velocities)
    this.integrate()

    this.iteration++

    // Check convergence
    if (this.iteration >= this.config.maxIterations) {
      this.converged = true
    }
  }

  private integrate(): void {
    const dt = this.config.timeStep
    const damping = this.config.dampingFactor

    for (const particle of this.particles) {
      if (particle.fixed) continue

      // Update velocity: v = v + a*dt
      particle.velocity.x += (particle.force.x / particle.mass) * dt
      particle.velocity.y += (particle.force.y / particle.mass) * dt
      particle.velocity.z += (particle.force.z / particle.mass) * dt

      // Apply damping
      particle.velocity.x *= damping
      particle.velocity.y *= damping
      particle.velocity.z *= damping

      // Update position: p = p + v*dt
      particle.position.x += particle.velocity.x * dt
      particle.position.y += particle.velocity.y * dt
      particle.position.z += particle.velocity.z * dt

      // Reset force
      particle.force.x = 0
      particle.force.y = 0
      particle.force.z = 0
    }
  }

  isConverged(): boolean {
    return this.converged
  }

  getIteration(): number {
    return this.iteration
  }
}
