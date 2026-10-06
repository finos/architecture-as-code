import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../test-support/memory-storage.js';
import {
    createMotionStore,
    MOTION_STORAGE_KEY,
    REDUCED_MOTION_QUERY,
    useMotion,
} from './useMotion.js';

/**
 * Drives `prefers-reduced-motion`. Returns a handle so a test can fire a `change`
 * event, simulating the user flipping the OS setting with the page open.
 */
function mockPrefersReducedMotion(prefersReduced: boolean) {
    const listeners = new Set<() => void>();
    let matches = prefersReduced;

    const matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
            return query === REDUCED_MOTION_QUERY ? matches : false;
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    return {
        matchMedia,
        flipTo(next: boolean) {
            matches = next;
            act(() => listeners.forEach((cb) => cb()));
        },
    };
}

const motionAttr = () => document.documentElement.getAttribute('data-motion');

describe('createMotionStore', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('data-motion');
    });

    it('defaults to full motion when the OS has no preference and nothing is stored', () => {
        const os = mockPrefersReducedMotion(false);
        const store = createMotionStore(createMemoryStorage(), os.matchMedia);

        expect(store.getSnapshot()).toBe('full');
        expect(motionAttr()).toBe('full');
    });

    it('follows the OS reduce-motion setting when nothing is stored', () => {
        const os = mockPrefersReducedMotion(true);
        const store = createMotionStore(createMemoryStorage(), os.matchMedia);

        expect(store.getSnapshot()).toBe('reduced');
        expect(motionAttr()).toBe('reduced');
    });

    it('tracks OS changes while following the system', () => {
        const os = mockPrefersReducedMotion(false);
        const store = createMotionStore(createMemoryStorage(), os.matchMedia);
        const onChange = vi.fn();
        store.subscribe(onChange);

        os.flipTo(true);

        expect(store.getSnapshot()).toBe('reduced');
        expect(motionAttr()).toBe('reduced');
        expect(onChange).toHaveBeenCalled();
    });

    it('lets a stored choice win over the OS setting', () => {
        const os = mockPrefersReducedMotion(true);
        const storage = createMemoryStorage();
        storage.setItem(MOTION_STORAGE_KEY, 'full');
        const store = createMotionStore(storage, os.matchMedia);

        expect(store.getSnapshot()).toBe('full');

        os.flipTo(true);
        expect(store.getSnapshot()).toBe('full');
    });

    it('ignores an unrecognised stored value', () => {
        const os = mockPrefersReducedMotion(false);
        const storage = createMemoryStorage();
        storage.setItem(MOTION_STORAGE_KEY, 'bogus');
        const store = createMotionStore(storage, os.matchMedia);

        expect(store.getSnapshot()).toBe('full');
    });

    it('toggles to the opposite of what is on screen, persists it and updates the attribute', () => {
        const os = mockPrefersReducedMotion(false);
        const storage = createMemoryStorage();
        const store = createMotionStore(storage, os.matchMedia);

        store.toggle();
        expect(store.getSnapshot()).toBe('reduced');
        expect(storage.getItem(MOTION_STORAGE_KEY)).toBe('reduced');
        expect(motionAttr()).toBe('reduced');

        store.toggle();
        expect(store.getSnapshot()).toBe('full');
        expect(storage.getItem(MOTION_STORAGE_KEY)).toBe('full');
        expect(motionAttr()).toBe('full');
    });

    it('still toggles when storage throws', () => {
        const os = mockPrefersReducedMotion(false);
        const storage = createMemoryStorage();
        vi.spyOn(storage, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        vi.spyOn(storage, 'setItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const store = createMotionStore(storage, os.matchMedia);

        expect(store.getSnapshot()).toBe('full');
        store.toggle();
        expect(store.getSnapshot()).toBe('reduced');
    });

    it('survives the localStorage global throwing when site data is blocked', () => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() {
                throw new DOMException('denied', 'SecurityError');
            },
        });
        try {
            const store = createMotionStore(undefined, mockPrefersReducedMotion(false).matchMedia);

            expect(store.getSnapshot()).toBe('full');
            store.toggle();
            expect(store.getSnapshot()).toBe('reduced');
        } finally {
            if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
        }
    });

    it('falls back to full motion when matchMedia is unavailable', () => {
        const store = createMotionStore(createMemoryStorage(), undefined);
        expect(store.getSnapshot()).toBe('full');
    });

    it('stops notifying a listener after it unsubscribes', () => {
        const os = mockPrefersReducedMotion(false);
        const store = createMotionStore(createMemoryStorage(), os.matchMedia);
        const onChange = vi.fn();

        const unsubscribe = store.subscribe(onChange);
        unsubscribe();
        store.toggle();

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('useMotion', () => {
    it('reflects the store and re-renders every consumer when it toggles', () => {
        const os = mockPrefersReducedMotion(false);
        const store = createMotionStore(createMemoryStorage(), os.matchMedia);
        const a = renderHook(() => useMotion(store));
        const b = renderHook(() => useMotion(store));

        expect(a.result.current.motion).toBe('full');

        act(() => a.result.current.toggleMotion());

        expect(a.result.current.motion).toBe('reduced');
        expect(b.result.current.motion).toBe('reduced');
    });
});
