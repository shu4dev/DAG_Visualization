/**
 * Core graph data types for layered DAG visualization
 */

export interface LayeredDAGGraph {
  metadata: GraphMetadata
  layers: Layer[]
  nodes: Node[]
  edges: Edge[]
}

export interface GraphMetadata {
  title?: string
  description?: string
  timeUnit?: 'day' | 'week' | 'month' | 'year' | 'custom'
  dataSource?: string
  [key: string]: unknown
}

export interface Layer {
  id: string
  index: number
  label?: string
  timestamp?: string
  zPosition?: number
  metadata?: Record<string, unknown>
}

export interface Node {
  id: string
  label: string
  layerIndex: number
  weight?: number
  position?: Vector3D
  velocity?: Vector3D
  metadata?: NodeMetadata
}

export interface NodeMetadata {
  frequency?: number
  documents?: number
  category?: string
  color?: string
  [key: string]: unknown
}

export interface Edge {
  id: string
  sourceId: string
  targetId: string
  metadata?: EdgeMetadata
}

export interface EdgeMetadata {
  type?: string
  strength?: number
  weight?: number
  [key: string]: unknown
}

export interface Vector3D {
  x: number
  y: number
  z: number
}
