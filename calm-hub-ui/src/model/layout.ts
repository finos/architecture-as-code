import type { StoredNodePosition } from '../visualizer/services/node-position-service.js';

/** A single node's saved position within a layout, keyed by its unique-id in the target document. */
export interface CalmLayoutPin {
    'unique-id': string;
    position: { x: number; y: number };
}

/**
 * A layout as stored server-side: the shared, default arrangement for an architecture.
 * Mirrors the `layout.json` draft schema (`calm/draft/2026-03/meta/layout.json`) — kept
 * schema-faithful here and converted to/from the ReactFlow-facing `StoredNodePosition[]`
 * shape at the boundary, so `unique-id` never leaks into the visualiser layer.
 */
export interface CalmLayout {
    for?: string;
    name?: string;
    description?: string;
    pins: CalmLayoutPin[];
}

export function pinsToStoredPositions(layout: CalmLayout): StoredNodePosition[] {
    return layout.pins.map((pin) => ({ id: pin['unique-id'], position: pin.position }));
}

export function storedPositionsToPins(positions: StoredNodePosition[]): CalmLayoutPin[] {
    return positions.map((position) => ({ 'unique-id': position.id, position: position.position }));
}
