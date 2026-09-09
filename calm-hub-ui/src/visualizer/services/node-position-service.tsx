import type { Node } from 'reactflow';
import { reflowContainersToFitChildren } from '../components/reactflow/utils/layoutUtils.js';

export interface StoredNodePosition {
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
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

/**
 * A diagram key has exactly this many `/`-separated segments — see
 * `buildViewportKey`. Exported so `legacyStorageKeyFor` and any other code
 * that needs to recognise the shape (rather than build it) shares the same
 * constant instead of a bare `3` magic number.
 */
export const VIEWPORT_KEY_SEGMENTS = 3;

/**
 * Builds the diagram key identifying a resource's viewport/scratch-position/
 * default-layout storage, independent of the version being viewed:
 * `namespace/calmType/id`. The single source of truth for this shape — call
 * this rather than hand-building the template, so a future change to the key
 * (e.g. adding a version component) can't update one call site and silently
 * drift from another, reintroducing the architecture/pattern id collision
 * this key shape was introduced to close (an Architecture 7 and a Pattern 7
 * can coexist in one namespace, since the two ids are drawn from independent
 * counters).
 */
export function buildViewportKey(namespace: string, calmType: string, id: string | number): string {
    return `${namespace}/${calmType}/${id}`;
}

/**
 * Derives the pre-calmType-qualified key (`namespace/id`) a diagram key
 * (`namespace/calmType/id`) would have been stored under before the calmType
 * component was added to prevent an architecture and a pattern with the same
 * numeric id from colliding. Used only as a one-time read fallback in
 * `loadStoredNodePositions`, so a user's already-dragged-but-unsaved layout
 * from before that change isn't silently discarded. `undefined` for any key
 * not in the `buildViewportKey` shape (e.g. a dropped file has no key at all).
 */
function legacyStorageKeyFor(key: string): string | undefined {
    const parts = key.split('/');
    return parts.length === VIEWPORT_KEY_SEGMENTS ? `${parts[0]}/${parts[2]}` : undefined;
}

/** Reduce a diagram's nodes to id, position, and measured dimensions worth persisting. */
export function toStoredPositions(nodes: Node[]): StoredNodePosition[] {
    return nodes.map((node) => {
        const n = node as Node & { width?: number; height?: number; measured?: { width?: number; height?: number } };
        const w = n.width ?? n.measured?.width;
        const h = n.height ?? n.measured?.height;
        return {
            id: node.id,
            position: { x: node.position.x, y: node.position.y },
            ...(w != null && h != null ? { width: w, height: h } : {}),
        };
    });
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

/**
 * The stored positions for a diagram key, or null when none/unreadable. Falls
 * back to the pre-calmType-qualified key (see `legacyStorageKeyFor`) when
 * nothing is stored under the current key, migrating any match forward (and
 * removing the legacy entry) so it is found directly next time and an
 * architecture/pattern id collision under the old key can't resurface it for
 * the wrong diagram later.
 */
export function loadStoredNodePositions(key: string, storage: Storage = localStorage): StoredNodePosition[] | null {
    try {
        const data = storage.getItem(storageKeyFor(key));
        if (data) return parseStoredPositions(data);

        const legacyKey = legacyStorageKeyFor(key);
        if (!legacyKey) return null;
        const legacyData = storage.getItem(storageKeyFor(legacyKey));
        if (!legacyData) return null;

        const positions = parseStoredPositions(legacyData);
        if (!positions) return null;

        storage.setItem(storageKeyFor(key), legacyData);
        storage.removeItem(storageKeyFor(legacyKey));
        return positions;
    } catch (err) {
        console.error('Failed to load node positions:', err);
        return null;
    }
}

/** Guards against valid JSON of an unexpected shape (e.g. tampered storage): only an array is usable downstream. */
function parseStoredPositions(data: string): StoredNodePosition[] | null {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? (parsed as StoredNodePosition[]) : null;
}

/**
 * Merge a set of positions (and optional dimensions) onto freshly parsed nodes,
 * matching by id. When all container nodes have explicit width/height in the
 * stored positions data, reflow is skipped — the layout is fully deterministic.
 * Otherwise, containers are reflowed to fit their children (backward compat with
 * position-only data). Returns the nodes unchanged when there is nothing to
 * apply, so callers fall back to the auto-layout.
 */
export function applyPositions(nodes: Node[], positions: StoredNodePosition[] | null): Node[] {
    if (!positions || positions.length === 0) return nodes;

    const positionsById = new Map(positions.map((p) => [p.id, p]));
    const merged = nodes.map((node) => {
        const stored = positionsById.get(node.id);
        if (!stored) return node;
        const updated = { ...node, position: { ...stored.position } } as Node & { width?: number; height?: number };
        if (stored.width != null && stored.height != null) {
            updated.width = stored.width;
            updated.height = stored.height;
            updated.style = { ...updated.style, width: stored.width, height: stored.height };
        }
        return updated;
    });

    // Only skip reflow when every container's dimensions came from the stored
    // positions (not from the node's own pre-existing width/height). This ensures
    // position-only restores (legacy data, localStorage scratch) still reflow.
    const containerIds = new Set(
        merged.filter((n) => n.parentId).map((n) => n.parentId!)
    );
    const allContainersDimensioned = containerIds.size === 0 ||
        [...containerIds].every((id) => {
            const stored = positionsById.get(id);
            return stored?.width != null && stored?.height != null;
        });

    return allContainersDimensioned ? merged : reflowContainersToFitChildren(merged);
}

/**
 * Merge any locally-stored positions onto freshly parsed nodes. Returns the
 * nodes unchanged when nothing is stored, so callers fall back to the
 * auto-layout.
 */
export function applyStoredPositions(key: string, nodes: Node[], storage: Storage = localStorage): Node[] {
    return applyPositions(nodes, loadStoredNodePositions(key, storage));
}
