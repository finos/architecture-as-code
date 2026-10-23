import { useSyncExternalStore } from 'react';

/** Presentation mode for the session: larger text on the diagram and in the JSON views, legible on a projector. */
export const PRESENTATION_MODE_KEY = 'calmHub.presentationMode';
const PRESENTATION_MODE_EVENT = 'calmhub:presentation-mode';

export function readPresentationMode(): boolean {
    try {
        return sessionStorage.getItem(PRESENTATION_MODE_KEY) === '1';
    } catch {
        return false;
    }
}

export function setPresentationMode(on: boolean) {
    try {
        sessionStorage.setItem(PRESENTATION_MODE_KEY, on ? '1' : '0');
    } catch {
        /* storage unavailable: the mode is not kept */
    }
    window.dispatchEvent(new Event(PRESENTATION_MODE_EVENT));
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

const subscribe = (onChange: () => void) => {
    window.addEventListener(PRESENTATION_MODE_EVENT, onChange);
    return () => window.removeEventListener(PRESENTATION_MODE_EVENT, onChange);
};

export const usePresentationMode = (): boolean => useSyncExternalStore(subscribe, readPresentationMode, () => false);
