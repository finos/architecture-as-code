import { useCallback, useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark';

/** Same storage key and default as the docs site (Docusaurus: light unless the visitor toggled). */
export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_COLOR_MODE: ColorMode = 'light';

function readStored(storage: Storage | undefined): ColorMode | undefined {
    try {
        const value = storage?.getItem(THEME_STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : undefined;
    } catch {
        return undefined;
    }
}

function defaultStorage(): Storage | undefined {
    try {
        return typeof window !== 'undefined' ? window.localStorage : undefined;
    } catch {
        return undefined;
    }
}

/** The mode to start in: the visitor's stored choice, else light — exactly like calm.finos.org. */
export function initialColorMode(storage: Storage | undefined = defaultStorage()): ColorMode {
    return readStored(storage) ?? DEFAULT_COLOR_MODE;
}

/** Stamps the mode on <html> the way Docusaurus does (`data-theme="light|dark"`). */
export function applyColorMode(mode: ColorMode): void {
    document.documentElement.setAttribute('data-theme', mode);
}

/**
 * Colour-mode state for the app frame, mirroring the docs navbar toggle: light by default, the
 * toggle persists, and the choice is stamped on <html> so CSS and the logo variant key off
 * `[data-theme]`. `storage` is injectable (default `localStorage`) per the repo's Node 26 rule.
 */
export function useColorMode(storage?: Storage): { mode: ColorMode; toggle: () => void } {
    const [mode, setMode] = useState<ColorMode>(() => initialColorMode(storage ?? defaultStorage()));

    useEffect(() => {
        applyColorMode(mode);
    }, [mode]);

    const toggle = useCallback(() => {
        setMode((current) => {
            const next: ColorMode = current === 'dark' ? 'light' : 'dark';
            try {
                (storage ?? defaultStorage())?.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // Storage unavailable (private mode, quota) — the choice still applies for this session.
            }
            return next;
        });
    }, [storage]);

    return { mode, toggle };
}
