import { useCallback, useEffect, useMemo, useState } from 'react';
import { NamespaceCounts } from '../../../model/counts.js';
import {
    ancestorPathsOf,
    buildNamespaceTree,
    collectVisiblePaths,
    flattenNamespaceTree,
    isNamespace,
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
    /** When set, show only namespaces it accepts (plus their ancestors), combined with `needle`. */
    canEdit?: (namespace: string) => boolean;
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
 * Composes {@link buildNamespaceTree}/{@link collectVisiblePaths}/{@link flattenNamespaceTree}
 * into a render-ready row list, with the collapsed set persisted across
 * sessions. Filtering never reads or writes the collapsed set — see
 * `namespace-tree.ts`'s `flattenNamespaceTree`.
 */
export function useNamespaceTree({ namespaceCounts, needle, canEdit, activeNamespace, storage = localStorage }: UseNamespaceTreeOptions): UseNamespaceTreeResult {
    const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(storage));

    // Reveal-on-navigate: reopen any ancestor of the newly active namespace.
    const [revealedFor, setRevealedFor] = useState<string | undefined>(undefined);
    if (activeNamespace !== revealedFor) {
        setRevealedFor(activeNamespace);
        const ancestors = activeNamespace ? ancestorPathsOf(activeNamespace) : [];
        if (ancestors.some((a) => collapsed.has(a))) {
            const next = new Set(collapsed);
            ancestors.forEach((a) => next.delete(a));
            setCollapsed(next);
        }
    }

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
    const filtering = needle.length > 0 || canEdit !== undefined;
    const visible = useMemo(() => {
        if (!filtering) return new Set<string>();
        return collectVisiblePaths(
            tree,
            (node) =>
                (needle === '' || node.path.toLowerCase().includes(needle)) &&
                (canEdit === undefined || (isNamespace(node) && canEdit(node.path)))
        );
    }, [tree, needle, canEdit, filtering]);
    const rows = useMemo(() => flattenNamespaceTree(tree, { collapsed, filtering, visible }), [tree, collapsed, filtering, visible]);

    return { rows, filtering, toggleCollapsed };
}
