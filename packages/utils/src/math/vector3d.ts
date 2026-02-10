/**
 * 3D Vector utility functions
 */

import type { Vector3D } from '@dag-viz/types'

export function create(x = 0, y = 0, z = 0): Vector3D {
  return { x, y, z }
}

export function add(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtract(a: Vector3D, b: Vector3D): Vector3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function multiply(v: Vector3D, scalar: number): Vector3D {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar }
}

export function dot(a: Vector3D, b: Vector3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function magnitude(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

export function normalize(v: Vector3D): Vector3D {
  const mag = magnitude(v)
  if (mag === 0) return { x: 0, y: 0, z: 0 }
  return multiply(v, 1 / mag)
}

export function distance(a: Vector3D, b: Vector3D): number {
  return magnitude(subtract(a, b))
}

export function distanceSquared(a: Vector3D, b: Vector3D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export function lerp(a: Vector3D, b: Vector3D, t: number): Vector3D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}
