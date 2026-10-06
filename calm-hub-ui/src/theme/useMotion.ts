import { useSyncExternalStore } from 'react';

export type Motion = 'full' | 'reduced';

/** Key under which an explicit user choice is persisted. Browser-local only. */
export const MOTION_STORAGE_KEY = 'calm-motion';

/** Media query the app follows when the user has not made a choice. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type MatchMedia = typeof window.matchMedia | undefined;

export interface MotionStore {
    getSnapshot: () => Motion;
    subscribe: (onChange: () => void) => () => void;
    toggle: () => void;
    /** True while no explicit choice is stored and the OS setting is in charge. */
    isFollowingSystem: () => boolean;
}

function isMotion(value: string | null): value is Motion {
    return value === 'full' || value === 'reduced';
}

function readStoredMotion(storage: Storage): Motion | null {
    try {
        const stored = storage.getItem(MOTION_STORAGE_KEY);
        return isMotion(stored) ? stored : null;
    } catch {
        return null;
    }
}

function writeStoredMotion(motion: Motion, storage: Storage): void {
    try {
        storage.setItem(MOTION_STORAGE_KEY, motion);
    } catch {
        // A persisted preference is a nicety; losing it must not break the toggle.
    }
}

/**
 * Resolves the motion preference and mirrors it onto `<html data-motion>`, which
 * CSS keys off to stop the diagram animations (see index.css).
 *
 * One store is shared by every consumer, so the toggle and the components that
 * read the value cannot drift apart. `index.html` applies the same resolution
 * before the bundle loads, so the first frame is already correct.
 *
 * @param storage Injected for tests; see the storage note in calm-hub-ui/AGENTS.md.
 */
export function createMotionStore(
    storage: Storage = localStorage,
    matchMedia: MatchMedia = typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window),
): MotionStore {
    const reducedQuery = matchMedia?.(REDUCED_MOTION_QUERY);
    const listeners = new Set<() => void>();
    let stored = readStoredMotion(storage);

    const resolve = (): Motion => stored ?? (reducedQuery?.matches ? 'reduced' : 'full');
    let current = resolve();
    document.documentElement.setAttribute('data-motion', current);

    const refresh = () => {
        const next = resolve();
        if (next === current) return;
        current = next;
        document.documentElement.setAttribute('data-motion', current);
        listeners.forEach((listener) => listener());
    };

    reducedQuery?.addEventListener?.('change', refresh);

    return {
        getSnapshot: () => current,
        subscribe(onChange) {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        toggle() {
            stored = current === 'reduced' ? 'full' : 'reduced';
            writeStoredMotion(stored, storage);
            refresh();
        },
        isFollowingSystem: () => stored === null,
    };
}

let defaultStore: MotionStore | undefined;

/** The app-wide store. Created on first use so tests can stub storage first. */
export function getMotionStore(): MotionStore {
    defaultStore ??= createMotionStore();
    return defaultStore;
}

export interface UseMotionResult {
    motion: Motion;
    toggleMotion: () => void;
    isFollowingSystem: boolean;
}

export function useMotion(store: MotionStore = getMotionStore()): UseMotionResult {
    const motion = useSyncExternalStore(store.subscribe, store.getSnapshot, () => 'full' as Motion);
    return { motion, toggleMotion: store.toggle, isFollowingSystem: store.isFollowingSystem() };
}
