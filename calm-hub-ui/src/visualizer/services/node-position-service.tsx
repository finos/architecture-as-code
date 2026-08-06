import type { Node } from 'reactflow';
import { reflowContainersToFitChildren } from '../components/reactflow/utils/layoutUtils.js';

export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
}

/**
 * Remembers a custom node layout (positions the user dragged nodes to) so it is
 * restored when they navigate away and back to the same diagram, instead of
 * resetting to the auto-generated layout.
 *
 * Keyed by the diagram key (namespace/id, see `viewportKey`) rather than the
 * diagram title, so distinct architectures that happen to share a title do not
 * collide. This is a personal, unsaved scratch layer: it holds only what *this*
 * user has dragged and never synced to the server. The shared, saved default
 * layout is fetched separately (see `layout-service.ts`) and takes lower
 * precedence than this scratch layer, so a user's in-progress drag is never
 * silently discarded — see `useDefaultLayout`.
 */
const STORAGE_PREFIX = 'calm-hub:node-positions:';

const storageKeyFor = (key: string) => `${STORAGE_PREFIX}${key}`;

/** Reduce a diagram's nodes to just the id/position pairs worth persisting. */
export function toStoredPositions(nodes: Node[]): StoredNodePosition[] {
    return nodes.map((node) => ({
        id: node.id,
        position: { x: node.position.x, y: node.position.y },
    }));
}

/** Persist the current positions of every node for the given diagram key. */
export function saveNodePositions(key: string, nodes: Node[], storage: Storage = localStorage) {
    try {
        storage.setItem(storageKeyFor(key), JSON.stringify(toStoredPositions(nodes)));
    } catch (err) {
        console.error('Failed to save node positions:', err);
    }
}

/** Remove any stored positions for the given diagram key. */
export function clearStoredNodePositions(key: string, storage: Storage = localStorage) {
    try {
        storage.removeItem(storageKeyFor(key));
    } catch (err) {
        console.error('Failed to clear node positions:', err);
    }
}

/** The stored positions for a diagram key, or null when none/unreadable. */
export function loadStoredNodePositions(key: string, storage: Storage = localStorage): StoredNodePosition[] | null {
    try {
        const data = storage.getItem(storageKeyFor(key));
        if (!data) return null;
        const parsed = JSON.parse(data);
        // Guard against valid JSON of an unexpected shape (e.g. tampered or
        // collided storage): only an array is usable downstream.
        return Array.isArray(parsed) ? (parsed as StoredNodePosition[]) : null;
    } catch (err) {
        console.error('Failed to load node positions:', err);
        return null;
    }
}

/**
 * Merge a set of positions onto freshly parsed nodes, matching by id, then
 * reflow containers so they re-hug their restored children. Returns the nodes
 * unchanged when there is nothing to apply, so callers fall back to the
 * auto-layout. Pure — shared by the localStorage scratch path
 * (`applyStoredPositions`) and by applying a server-saved default layout.
 */
export function applyPositions(nodes: Node[], positions: StoredNodePosition[] | null): Node[] {
    if (!positions || positions.length === 0) return nodes;

    const positionsById = new Map(positions.map((p) => [p.id, p.position]));
    const merged = nodes.map((node) => {
        const position = positionsById.get(node.id);
        return position ? { ...node, position: { ...position } } : node;
    });

    return reflowContainersToFitChildren(merged);
}

/**
 * Merge any locally-stored positions onto freshly parsed nodes. Returns the
 * nodes unchanged when nothing is stored, so callers fall back to the
 * auto-layout.
 */
export function applyStoredPositions(key: string, nodes: Node[], storage: Storage = localStorage): Node[] {
    return applyPositions(nodes, loadStoredNodePositions(key, storage));
}
