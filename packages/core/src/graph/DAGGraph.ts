/**
 * Main DAG Graph data structure
 */

import type { LayeredDAGGraph, Node, Edge, Layer } from '@dag-viz/types'

export class DAGGraph {
  private nodes: Map<string, Node>
  private edges: Map<string, Edge>
  private layers: Map<number, Layer>

  constructor(data?: LayeredDAGGraph) {
    this.nodes = new Map()
    this.edges = new Map()
    this.layers = new Map()

    if (data) {
      this.load(data)
    }
  }

  load(data: LayeredDAGGraph): void {
    // Clear existing data
    this.nodes.clear()
    this.edges.clear()
    this.layers.clear()

    // Load layers
    for (const layer of data.layers) {
      this.layers.set(layer.index, layer)
    }

    // Load nodes
    for (const node of data.nodes) {
      this.nodes.set(node.id, node)
    }

    // Load edges
    for (const edge of data.edges) {
      this.edges.set(edge.id, edge)
    }
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id)
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id)
  }

  getLayer(index: number): Layer | undefined {
    return this.layers.get(index)
  }

  getAllNodes(): Node[] {
    return Array.from(this.nodes.values())
  }

  getAllEdges(): Edge[] {
    return Array.from(this.edges.values())
  }

  getAllLayers(): Layer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.index - b.index)
  }

  getNodesByLayer(layerIndex: number): Node[] {
    return this.getAllNodes().filter((node) => node.layerIndex === layerIndex)
  }
}
