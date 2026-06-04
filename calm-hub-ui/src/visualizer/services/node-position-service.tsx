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
 * collide. localStorage is used so the layout survives a refresh and a new
 * tab/session. A durable, version-aware, server-side strategy is tracked
 * separately (#2568).
 */
const STORAGE_PREFIX = 'calm-hub:node-positions:';

const storageKeyFor = (key: string) => `${STORAGE_PREFIX}${key}`;

/** Persist the current positions of every node for the given diagram key. */
export function saveNodePositions(key: string, nodes: Node[]) {
    try {
        const positions: StoredNodePosition[] = nodes.map((node) => ({
            id: node.id,
            position: { x: node.position.x, y: node.position.y },
        }));
        localStorage.setItem(storageKeyFor(key), JSON.stringify(positions));
    } catch (err) {
        console.error('Failed to save node positions:', err);
    }
}

/** The stored positions for a diagram key, or null when none/unreadable. */
export function loadStoredNodePositions(key: string): StoredNodePosition[] | null {
    try {
        const data = localStorage.getItem(storageKeyFor(key));
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
 * Merge any stored positions onto freshly parsed nodes, matching by id, then
 * reflow containers so they re-hug their restored children. Returns the nodes
 * unchanged when nothing is stored, so callers fall back to the auto-layout.
 */
export function applyStoredPositions(key: string, nodes: Node[]): Node[] {
    const stored = loadStoredNodePositions(key);
    if (!stored || stored.length === 0) return nodes;

    const positionsById = new Map(stored.map((p) => [p.id, p.position]));
    const merged = nodes.map((node) => {
        const position = positionsById.get(node.id);
        return position ? { ...node, position: { ...position } } : node;
    });

    return reflowContainersToFitChildren(merged);
}
