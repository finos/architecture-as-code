import { useSyncExternalStore } from 'react';

/** Key under which presentation mode is kept for the session. */
export const PRESENTATION_MODE_KEY = 'calmHub.presentationMode';

export interface PresentationModeStore {
    getSnapshot: () => boolean;
    subscribe: (onChange: () => void) => () => void;
    set: (on: boolean) => void;
}

/** Reading the `sessionStorage` global itself throws when site data is blocked. */
function defaultStorage(): Storage | undefined {
    try {
        return sessionStorage;
    } catch {
        return undefined;
    }
}

function readStoredMode(storage: Storage | undefined): boolean {
    try {
        return storage?.getItem(PRESENTATION_MODE_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Presentation mode: larger text on the diagram and in the JSON views, legible on a projector. The mode is kept for the
 * session, because a switch between diagram tabs drops the `present` query.
 *
 * One store is shared by every consumer, so the toggle and the components that read the value cannot drift apart.
 *
 * @param storage Injected for tests; see the storage note in calm-hub-ui/AGENTS.md.
 */
export function createPresentationModeStore(storage: Storage | undefined = defaultStorage()): PresentationModeStore {
    const listeners = new Set<() => void>();
    let current = readStoredMode(storage);

    return {
        getSnapshot: () => current,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        set(on) {
            try {
                storage?.setItem(PRESENTATION_MODE_KEY, on ? '1' : '0');
            } catch {
                // Storage unavailable: the mode is not kept.
            }
            if (on === current) return;
            current = on;
            listeners.forEach((listener) => listener());
        },
    };
}

let defaultStore: PresentationModeStore | undefined;

/** The app-wide store. Created on first use so tests can stub storage first. */
export function getPresentationModeStore(): PresentationModeStore {
    defaultStore ??= createPresentationModeStore();
    return defaultStore;
}

export interface UsePresentationModeResult {
    presenting: boolean;
    setPresenting: (on: boolean) => void;
}

export function usePresentationMode(store: PresentationModeStore = getPresentationModeStore()): UsePresentationModeResult {
    const presenting = useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
    return { presenting, setPresenting: store.set };
}

/**
 * The `present` query parameter: true for `present=1`, false for `present=0`, undefined when absent. The hub routes
 * through the hash, so the parameter is after the `?` in the hash (`#/ns/architectures/1/1.0.0?present=1`).
 */
export function presentParam(): boolean | undefined {
    const { hash, search } = window.location;
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const value = new URLSearchParams(hashQuery).get('present') ?? new URLSearchParams(search).get('present');
    return value === '1' ? true : value === '0' ? false : undefined;
}
