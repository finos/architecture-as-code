import type { StoredNodePosition } from '../visualizer/services/node-position-service.js';

/** A single node's geometry within a layout — position and optional dimensions. */
export interface LayoutEntry { x: number; y: number; w?: number; h?: number }

/** Map keyed by node unique-id — the same shape the VS Code plugin persists in metadata._layout. */
export type LayoutMap = Record<string, LayoutEntry>;

/** Legacy pin format from the initial layout persistence (PR #2942). */
export interface CalmLayoutPin {
    'unique-id': string;
    position: { x: number; y: number };
}

/**
 * A layout as stored server-side: the shared, default arrangement for an architecture.
 * This is a CALM Hub-internal wire format — not a CALM community schema — and this
 * interface is its authoritative shape. The `nodes` map matches the VS Code plugin's
 * `metadata._layout` format for rendering parity.
 */
export interface CalmLayout {
    for?: string;
    name?: string;
    description?: string;
    nodes: LayoutMap;
}

/** Convert an API response (new `nodes` map or legacy `pins` array) to StoredNodePositions. */
export function apiResponseToStoredPositions(layout: Record<string, unknown>): StoredNodePosition[] {
    if (layout.nodes && typeof layout.nodes === 'object' && !Array.isArray(layout.nodes)) {
        const nodes = layout.nodes as LayoutMap;
        return Object.entries(nodes).map(([id, entry]) => ({
            id,
            position: { x: entry.x, y: entry.y },
            ...(entry.w != null && entry.h != null ? { width: entry.w, height: entry.h } : {}),
        }));
    }
    if (Array.isArray((layout as { pins?: unknown }).pins)) {
        const pins = (layout as { pins: CalmLayoutPin[] }).pins;
        return pins.map((pin) => ({ id: pin['unique-id'], position: pin.position }));
    }
    return [];
}

/** Convert a LayoutMap (VS Code _layout format or new API format) to StoredNodePositions. */
export function layoutMapToStoredPositions(layoutMap: LayoutMap): StoredNodePosition[] {
    return Object.entries(layoutMap).map(([id, entry]) => ({
        id,
        position: { x: entry.x, y: entry.y },
        ...(entry.w != null && entry.h != null ? { width: entry.w, height: entry.h } : {}),
    }));
}

/** Convert StoredNodePositions to the wire-format LayoutMap for saving. */
export function storedPositionsToLayoutMap(positions: StoredNodePosition[]): LayoutMap {
    const map: LayoutMap = {};
    for (const p of positions) {
        map[p.id] = {
            x: Math.round(p.position.x),
            y: Math.round(p.position.y),
            ...(p.width != null && p.height != null ? { w: Math.round(p.width), h: Math.round(p.height) } : {}),
        };
    }
    return map;
}
