import { useSyncExternalStore } from 'react';

/** Key under which the diagram text scale is kept. Browser-local only. */
export const DIAGRAM_TEXT_SCALE_KEY = 'calmHub.diagramTextScale';

const SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
const DEFAULT_INDEX = SCALES.indexOf(1);

export interface DiagramTextScaleStore {
    getSnapshot: () => number;
    subscribe: (onChange: () => void) => () => void;
    step: (direction: 1 | -1) => void;
}

/** Reading the `localStorage` global itself throws when site data is blocked. */
function defaultStorage(): Storage | undefined {
    try {
        return localStorage;
    } catch {
        return undefined;
    }
}

function readStoredIndex(storage: Storage | undefined): number {
    try {
        const index = SCALES.indexOf(Number(storage?.getItem(DIAGRAM_TEXT_SCALE_KEY) ?? undefined));
        return index === -1 ? DEFAULT_INDEX : index;
    } catch {
        return DEFAULT_INDEX;
    }
}

/**
 * The size of the text drawn on the diagram, separate from the zoom. One store is shared by every consumer, so the
 * buttons and the nodes and edges that read the value cannot drift apart.
 *
 * @param storage Injected for tests; see the storage note in calm-hub-ui/AGENTS.md.
 */
export function createDiagramTextScaleStore(storage: Storage | undefined = defaultStorage()): DiagramTextScaleStore {
    const listeners = new Set<() => void>();
    let index = readStoredIndex(storage);

    return {
        getSnapshot: () => SCALES[index],
        subscribe(onChange) {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        step(direction) {
            const next = index + direction;
            if (next < 0 || next >= SCALES.length) return;
            index = next;
            try {
                storage?.setItem(DIAGRAM_TEXT_SCALE_KEY, String(SCALES[index]));
            } catch {
                // Storage unavailable: the scale is not kept.
            }
            listeners.forEach((listener) => listener());
        },
    };
}

let defaultStore: DiagramTextScaleStore | undefined;

/** The app-wide store. Created on first use so tests can stub storage first. */
function getDiagramTextScaleStore(): DiagramTextScaleStore {
    defaultStore ??= createDiagramTextScaleStore();
    return defaultStore;
}

export interface UseDiagramTextScaleResult {
    scale: number;
    canGrow: boolean;
    canShrink: boolean;
    grow: () => void;
    shrink: () => void;
}

export function useDiagramTextScale(store: DiagramTextScaleStore = getDiagramTextScaleStore()): UseDiagramTextScaleResult {
    const scale = useSyncExternalStore(store.subscribe, store.getSnapshot, () => 1);
    return {
        scale,
        canGrow: scale < SCALES[SCALES.length - 1],
        canShrink: scale > SCALES[0],
        grow: () => store.step(1),
        shrink: () => store.step(-1),
    };
}

/** A pixel size multiplied by the scale, rounded to a tenth of a pixel. */
export function scalePx(px: number, scale: number): string {
    return `${Math.round(px * scale * 10) / 10}px`;
}
