import type { Viewport } from 'reactflow';

/**
 * Remembers the diagram viewport (zoom + pan) for the diagram currently being
 * viewed, so a page refresh restores it instead of re-running fit-to-view.
 *
 * Only one viewport is kept, tagged with the diagram it belongs to (namespace/id,
 * ignoring version). Selecting a different architecture has a different key, so
 * nothing is restored for it (it fits to view) and the previous diagram's
 * viewport is overwritten — i.e. it is only remembered whilst on that diagram.
 * sessionStorage is used so it survives a refresh but not a new tab/session.
 */
const STORAGE_KEY = 'calm-hub:diagram-viewport';

interface StoredViewport {
    key: string;
    viewport: Viewport;
}

/** The saved viewport, but only when it belongs to the given diagram key. */
export function readViewportForKey(key: string, storage: Storage = sessionStorage): Viewport | undefined {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return undefined;
        const stored = JSON.parse(raw) as StoredViewport;
        return stored.key === key ? stored.viewport : undefined;
    } catch {
        return undefined;
    }
}

/** Save the viewport for a diagram key, replacing any previous diagram's. */
export function saveViewportForKey(key: string, viewport: Viewport, storage: Storage = sessionStorage): void {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ key, viewport }));
    } catch {
        /* ignore unavailable storage */
    }
}
