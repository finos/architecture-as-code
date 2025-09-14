// src/preview/types.ts
export interface GraphData {
    nodes: ReadonlyArray<{ id: string; label: string; type?: string }>
    edges: ReadonlyArray<{ id: string; source: string; target: string; label?: string; type?: string }>
}

export type LastData = {
    graph: GraphData
    selectedId?: string
    settings?: unknown
    positions?: Record<string, { x: number; y: number }>
    viewport?: { pan: { x: number; y: number }; zoom: number }
} | undefined
