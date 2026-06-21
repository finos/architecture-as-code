import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery, useIsMobile } from './useMediaQuery.js';

type Listener = () => void;

/**
 * Install a controllable matchMedia mock and return a helper to flip the
 * match state and notify subscribers.
 */
function installMatchMedia(initialMatches: boolean) {
    let matches = initialMatches;
    const listeners = new Set<Listener>();

    const matchMedia = vi.fn((query: string) => ({
        get matches() {
            return matches;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: Listener) => listeners.add(cb),
        removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
        addListener: (cb: Listener) => listeners.add(cb),
        removeListener: (cb: Listener) => listeners.delete(cb),
        dispatchEvent: () => false,
    }));

    window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

    return {
        setMatches(next: boolean) {
            matches = next;
            listeners.forEach((cb) => cb());
        },
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useMediaQuery', () => {
    it('returns the initial match state', () => {
        installMatchMedia(true);
        const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
        expect(result.current).toBe(true);
    });

    it('updates when the media query changes', () => {
        const mm = installMatchMedia(false);
        const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
        expect(result.current).toBe(false);

        act(() => mm.setMatches(true));
        expect(result.current).toBe(true);
    });

    it('returns false when matchMedia is unavailable', () => {
        // @ts-expect-error - simulate an environment without matchMedia
        window.matchMedia = undefined;
        const { result } = renderHook(() => useMediaQuery('(max-width: 1023px)'));
        expect(result.current).toBe(false);
    });
});

describe('useIsMobile', () => {
    it('is true when the viewport is below the lg breakpoint', () => {
        installMatchMedia(true);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(true);
    });

    it('is false on wide viewports', () => {
        installMatchMedia(false);
        const { result } = renderHook(() => useIsMobile());
        expect(result.current).toBe(false);
    });
});
