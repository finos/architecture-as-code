import { useCallback, useEffect, useMemo, useState } from 'react';
import { NamespaceCounts } from '../../../model/counts.js';
import {
    ancestorPathsOf,
    buildNamespaceTree,
    filterNamespaceTree,
    flattenNamespaceTree,
    type NamespaceRow,
} from './namespace-tree.js';

/** Persist which namespaces are collapsed so a refresh keeps the rail as it was. */
const COLLAPSED_STORAGE_KEY = 'calmHub.railCollapsedNamespaces';

function readCollapsed(storage: Storage): Set<string> {
    try {
        const raw = storage.getItem(COLLAPSED_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((p): p is string => typeof p === 'string'));
    } catch {
        return new Set();
    }
}

interface UseNamespaceTreeOptions {
    namespaceCounts: NamespaceCounts[];
    /** Trimmed, lower-cased filter text — empty string means browse mode. */
    needle: string;
    /** The namespace the current route resolves to, if any — reveals its ancestors on navigate. */
    activeNamespace?: string;
    /** Storage instance for persisting the collapsed set. Defaults to localStorage. Inject a fake in tests. */
    storage?: Storage;
}

interface UseNamespaceTreeResult {
    rows: NamespaceRow[];
    filtering: boolean;
    toggleCollapsed: (path: string) => void;
}

/**
 * Composes {@link buildNamespaceTree}/{@link filterNamespaceTree}/{@link flattenNamespaceTree}
 * into a render-ready row list, with the collapsed set persisted across
 * sessions. Filtering never reads or writes the collapsed set — see
 * `namespace-tree.ts`'s `flattenNamespaceTree`.
 */
export function useNamespaceTree({ namespaceCounts, needle, activeNamespace, storage = localStorage }: UseNamespaceTreeOptions): UseNamespaceTreeResult {
    const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(storage));

    // Reveal-on-navigate: reopen any ancestor of the newly active namespace.
    useEffect(() => {
        if (!activeNamespace) return;
        const ancestors = ancestorPathsOf(activeNamespace);
        if (ancestors.length === 0) return;
        setCollapsed((prev) => {
            if (!ancestors.some((a) => prev.has(a))) return prev;
            const next = new Set(prev);
            ancestors.forEach((a) => next.delete(a));
            return next;
        });
    }, [activeNamespace]);

    useEffect(() => {
        try {
            storage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
        } catch {
            /* ignore unavailable storage */
        }
    }, [collapsed, storage]);

    const toggleCollapsed = useCallback((path: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const tree = useMemo(() => buildNamespaceTree(namespaceCounts), [namespaceCounts]);
    const filtering = needle.length > 0;
    const visible = useMemo(() => (filtering ? filterNamespaceTree(tree, needle) : new Set<string>()), [tree, needle, filtering]);
    const rows = useMemo(() => flattenNamespaceTree(tree, { collapsed, filtering, visible }), [tree, collapsed, filtering, visible]);

    return { rows, filtering, toggleCollapsed };
}
