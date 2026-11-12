import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DecoratorView } from '../contracts/contracts.js';
import { hasOverlay, viewKey } from './overlayEngine.js';

export const OVERLAY_VISIBILITY_KEY = 'calm-hub-overlay-views';
/**
 * Without a stored choice, only this many extension views start switched on, so many extensions do not crowd each
 * node. Built-in views are always on by default and do not count.
 */
export const OVERLAYS_ON_BY_DEFAULT = 3;

type Choices = Record<string, boolean>;

function readChoices(storage: Storage | undefined): Choices {
    try {
        const parsed: unknown = JSON.parse(storage?.getItem(OVERLAY_VISIBILITY_KEY) ?? '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'boolean'));
    } catch {
        return {};
    }
}

function defaultStorage(): Storage | undefined {
    try {
        return localStorage;
    } catch {
        return undefined;
    }
}

/**
 * Which overlay views the legend shows. A choice is kept in storage, for every diagram, by view key.
 *
 * `views` is the registered list, not the views drawn on this diagram, so a default does not change between diagrams
 * or when a refresh brings new decorators.
 */
export function useOverlayVisibility(views: readonly DecoratorView[], storage: Storage | undefined = defaultStorage()) {
    const [choices, setChoices] = useState<Choices>(() => readChoices(storage));
    // Only a choice is written: a visit that changes nothing leaves storage as it is.
    const chosen = useRef(false);

    // In an effect, not in the state updater, which React can call more than one time.
    useEffect(() => {
        if (!chosen.current) return;
        try {
            storage?.setItem(OVERLAY_VISIBILITY_KEY, JSON.stringify(choices));
        } catch {
            // A full or blocked storage only loses the choice for the next visit.
        }
    }, [choices, storage]);

    const hiddenViews = useMemo(() => {
        const hidden = new Set<string>();
        let extensionViews = 0;
        for (const view of views.filter(hasOverlay)) {
            const key = viewKey(view);
            const onByDefault = view.source?.builtIn === true || extensionViews++ < OVERLAYS_ON_BY_DEFAULT;
            if (!(choices[key] ?? onByDefault)) hidden.add(key);
        }
        return hidden as ReadonlySet<string>;
    }, [views, choices]);

    const setViewsShown = useCallback(
        (keys: readonly string[], shown: boolean) => {
            chosen.current = true;
            setChoices((prev) => {
                const next = { ...prev };
                for (const key of keys) next[key] = shown;
                return next;
            });
        },
        [],
    );

    const toggleView = useCallback(
        (key: string) => setViewsShown([key], hiddenViews.has(key)),
        [hiddenViews, setViewsShown],
    );

    return { hiddenViews, toggleView, setViewsShown };
}
