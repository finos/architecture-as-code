import { useCallback, useEffect, useRef, useState } from 'react';

type OpenState = Record<string, boolean>;

function read(storage: Storage | undefined, key: string): OpenState {
    try {
        const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '{}');
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
 * Which collapsible sections are open, by section id. Without a stored choice only `defaultOpenId` is open: give the
 * first id of the full list, not of a filtered one, so a filter does not close a section.
 * A choice is kept in storage under `storageKey`. `linkedId`, the section that a link names, is open until the user
 * opens or closes it, and is not stored.
 */
export function useOpenSections(storageKey: string, storage: Storage | undefined = defaultStorage(), linkedId?: string) {
    const [open, setOpen] = useState<OpenState>(() => read(storage, storageKey));
    // Only a choice is written: a visit that changes nothing leaves storage as it is.
    const chosen = useRef(false);
    const [linked, setLinked] = useState({ from: linkedId, open: linkedId });
    if (linked.from !== linkedId) setLinked({ from: linkedId, open: linkedId });

    // In an effect, not in the state updater, which React can call more than one time.
    useEffect(() => {
        if (!chosen.current) return;
        try {
            storage?.setItem(storageKey, JSON.stringify(open));
        } catch {
            // A full or blocked storage only loses the choice for the next visit.
        }
    }, [open, storage, storageKey]);

    const linkedOpen = linked.from === linkedId ? linked.open : linkedId;
    const isOpen = useCallback(
        (id: string, defaultOpenId: string | undefined) => id === linkedOpen || (open[id] ?? id === defaultOpenId),
        [open, linkedOpen],
    );

    const setSectionOpen = useCallback(
        (id: string, value: boolean) => {
            chosen.current = true;
            setLinked((prev) => (prev.open === id ? { ...prev, open: undefined } : prev));
            setOpen((prev) => ({ ...prev, [id]: value }));
        },
        [],
    );

    return { isOpen, setSectionOpen };
}
