import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

export type Theme = 'light' | 'dark';

/** Key under which an explicit user choice is persisted. */
export const THEME_STORAGE_KEY = 'calm-theme';

/** Media query the app follows when the user has expressed no preference. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function isTheme(value: string | null): value is Theme {
    return value === 'light' || value === 'dark';
}

/**
 * The user's explicit choice, or null when they have not made one (in which case
 * the app follows the OS). Storage access throws in Safari's private mode, so a
 * failure is treated the same as "no preference".
 */
export function readStoredTheme(storage: Storage = localStorage): Theme | null {
    try {
        const stored = storage.getItem(THEME_STORAGE_KEY);
        return isTheme(stored) ? stored : null;
    } catch {
        return null;
    }
}

function writeStoredTheme(theme: Theme, storage: Storage): void {
    try {
        storage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // A persisted preference is a nicety; losing it must not break the toggle.
    }
}

export interface UseThemeResult {
    /** The theme currently applied to the document. */
    theme: Theme;
    /** Flip to the other theme and remember the choice. */
    toggleTheme: () => void;
    /** True while no explicit choice is stored and the OS setting is in charge. */
    isFollowingSystem: boolean;
}

/**
 * Resolves the active theme and mirrors it onto `<html data-theme>`.
 *
 * The attribute is the single source of truth for both theming systems: daisyUI's
 * `[data-theme]` blocks and the `--calm-*` tokens in theme.css. We resolve the OS
 * preference here rather than leaning on daisyUI's `--prefersdark`, because that
 * only emits a `prefers-color-scheme` block for daisyUI's own variables — the
 * `--calm-*` tokens would resolve to nothing and half the app would lose its colour.
 *
 * `index.html` applies the same resolution synchronously before the bundle loads,
 * so this hook re-affirms an attribute that is already correct rather than causing
 * a flash on first paint.
 *
 * The toggle is binary over a tri-state model (follow-OS / light / dark): the first
 * click from the follow-OS state stores the opposite of whatever is on screen,
 * which is what pressing a toggle is expected to do. There is no affordance for
 * returning to follow-OS.
 *
 * @param storage Injected for tests; see the storage note in calm-hub-ui/AGENTS.md.
 */
export function useTheme(storage: Storage = localStorage): UseThemeResult {
    const [stored, setStored] = useState<Theme | null>(() => readStoredTheme(storage));
    const prefersDark = useMediaQuery(DARK_MEDIA_QUERY);

    const theme: Theme = stored ?? (prefersDark ? 'dark' : 'light');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        writeStoredTheme(next, storage);
        setStored(next);
    }, [theme, storage]);

    return { theme, toggleTheme, isFollowingSystem: stored === null };
}

function subscribeToThemeAttribute(onChange: () => void): () => void {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
}

function readThemeAttribute(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * The active theme, read straight off `<html data-theme>`.
 *
 * For the components CSS cannot reach — the Monaco editor, and anything else that
 * carries its own theme system. `useTheme` owns the attribute; this only observes
 * it, so there is exactly one source of truth and no second copy of the state to
 * drift out of step when the toggle is pressed. Call it anywhere, no provider.
 */
export function useResolvedTheme(): Theme {
    return useSyncExternalStore(subscribeToThemeAttribute, readThemeAttribute, () => 'light');
}
