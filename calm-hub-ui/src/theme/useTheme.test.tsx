import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../test-support/memory-storage.js';
import {
    DARK_MEDIA_QUERY,
    readStoredTheme,
    THEME_STORAGE_KEY,
    useResolvedTheme,
    useTheme,
} from './useTheme.js';

/**
 * Drives `prefers-color-scheme`. Returns a handle so a test can fire a `change`
 * event, simulating the user flipping their OS appearance with the page open.
 */
function mockPrefersDark(prefersDark: boolean) {
    const listeners = new Set<() => void>();
    let matches = prefersDark;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
            return query === DARK_MEDIA_QUERY ? matches : false;
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        addListener: (cb: () => void) => listeners.add(cb),
        removeListener: (cb: () => void) => listeners.delete(cb),
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia;

    return {
        flipTo(next: boolean) {
            matches = next;
            act(() => listeners.forEach((cb) => cb()));
        },
    };
}

const themeAttr = () => document.documentElement.getAttribute('data-theme');

describe('readStoredTheme', () => {
    it('returns the stored theme when it is valid', () => {
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'dark');
        expect(readStoredTheme(storage)).toBe('dark');
    });

    it('returns null for an absent or unrecognised value', () => {
        const storage = createMemoryStorage();
        expect(readStoredTheme(storage)).toBeNull();
        storage.setItem(THEME_STORAGE_KEY, 'solarized');
        expect(readStoredTheme(storage)).toBeNull();
    });

    it('treats a throwing storage (Safari private mode) as no preference', () => {
        const hostile = {
            getItem: () => {
                throw new Error('SecurityError');
            },
        } as unknown as Storage;
        expect(readStoredTheme(hostile)).toBeNull();
    });
});

describe('useTheme', () => {
    // Restore matchMedia by hand rather than with vi.unstubAllGlobals(): that would
    // also drop the localStorage stub vitest.setup.ts installs for Node 26, whose own
    // afterEach then throws.
    const realMatchMedia = window.matchMedia;

    beforeEach(() => {
        document.documentElement.removeAttribute('data-theme');
    });

    afterEach(() => {
        window.matchMedia = realMatchMedia;
        vi.restoreAllMocks();
    });

    it('follows the OS when no preference is stored', () => {
        mockPrefersDark(true);
        const { result } = renderHook(() => useTheme(createMemoryStorage()));

        expect(result.current.theme).toBe('dark');
        expect(result.current.isFollowingSystem).toBe(true);
        expect(themeAttr()).toBe('dark');
    });

    it('falls back to light when the OS prefers light', () => {
        mockPrefersDark(false);
        const { result } = renderHook(() => useTheme(createMemoryStorage()));

        expect(result.current.theme).toBe('light');
        expect(themeAttr()).toBe('light');
    });

    it('tracks a live OS change while following the system', () => {
        const media = mockPrefersDark(false);
        const { result } = renderHook(() => useTheme(createMemoryStorage()));
        expect(result.current.theme).toBe('light');

        media.flipTo(true);

        expect(result.current.theme).toBe('dark');
        expect(themeAttr()).toBe('dark');
    });

    it('lets a stored preference override the OS', () => {
        mockPrefersDark(true);
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'light');

        const { result } = renderHook(() => useTheme(storage));

        expect(result.current.theme).toBe('light');
        expect(result.current.isFollowingSystem).toBe(false);
        expect(themeAttr()).toBe('light');
    });

    it('ignores the OS once a preference is stored', () => {
        const media = mockPrefersDark(false);
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'dark');
        const { result } = renderHook(() => useTheme(storage));

        media.flipTo(true);

        expect(result.current.theme).toBe('dark');
    });

    it('toggling from the follow-OS state stores the opposite of what is on screen', () => {
        mockPrefersDark(true);
        const storage = createMemoryStorage();
        const { result } = renderHook(() => useTheme(storage));

        act(() => result.current.toggleTheme());

        expect(result.current.theme).toBe('light');
        expect(result.current.isFollowingSystem).toBe(false);
        expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
        expect(themeAttr()).toBe('light');
    });

    it('flips back and forth once a preference exists', () => {
        mockPrefersDark(false);
        const storage = createMemoryStorage();
        const { result } = renderHook(() => useTheme(storage));

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('dark');

        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('light');
        expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('still toggles when storage refuses to persist', () => {
        mockPrefersDark(false);
        const hostile = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        } as unknown as Storage;
        const { result } = renderHook(() => useTheme(hostile));

        act(() => result.current.toggleTheme());

        expect(result.current.theme).toBe('dark');
        expect(themeAttr()).toBe('dark');
    });
});

describe('useResolvedTheme', () => {
    afterEach(() => document.documentElement.removeAttribute('data-theme'));

    it('reads the theme off the document attribute', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        const { result } = renderHook(() => useResolvedTheme());
        expect(result.current).toBe('dark');
    });

    it('treats an absent attribute as light', () => {
        document.documentElement.removeAttribute('data-theme');
        const { result } = renderHook(() => useResolvedTheme());
        expect(result.current).toBe('light');
    });

    it('re-renders when the attribute changes, so it never drifts from useTheme', async () => {
        document.documentElement.setAttribute('data-theme', 'light');
        const { result } = renderHook(() => useResolvedTheme());
        expect(result.current).toBe('light');

        act(() => document.documentElement.setAttribute('data-theme', 'dark'));

        await waitFor(() => expect(result.current).toBe('dark'));
    });
});
