import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';
import { LayoutService, LayoutResourceType } from '../../service/layout-service.js';
import { isSlug } from '../../model/calm.js';
import { CalmLayout, apiResponseToStoredPositions, storedPositionsToLayoutMap, layoutMapToStoredPositions, type LayoutMap } from '../../model/layout.js';
import { buildViewportKey, clearStoredNodePositions, StoredNodePosition } from '../../visualizer/services/node-position-service.js';

export type LayoutSource = 'document' | 'server' | 'auto';

export interface UseDefaultLayoutResult {
    /**
     * Namespace + calmType + resolved numeric id — the single key both the
     * localStorage scratch layer and the server layout are addressed by, so a
     * diagram reached via a slug route and via its numeric route share one
     * scratch entry and one server call. The calmType component exists
     * because architecture ids and pattern ids are allocated from independent
     * counters — an Architecture 7 and a Pattern 7 can coexist in the same
     * namespace, and without a type qualifier they would collide on one
     * scratch-position entry and one viewport entry. Built with
     * `buildViewportKey`, the single source of truth for this shape — shared
     * with `Drawer`'s own fallback key computation so the two can't drift
     * apart. Three states:
     *  - a string: the resolved key.
     *  - `undefined`: not applicable (a dropped file, or a calmType this hook
     *    doesn't support), or a slug that is still resolving — callers with a
     *    loading state to show key off this.
     *  - `null`: this *is* a supported type, but resolution finished without
     *    a numeric id (an unresolvable slug, or the mapping fetch failed).
     *    Never `undefined` here — a caller that fell back to some other key
     *    (e.g. the raw slug) in this state would reintroduce the exact split
     *    this key exists to prevent. See `Drawer`'s `viewportKeyOverride`
     *    handling.
     */
    viewportKey: string | null | undefined;
    /** undefined = loading, null = none stored, else the resolved default layout. */
    defaultLayout: StoredNodePosition[] | null | undefined;
    /** Bumped after a successful save or a reset, to force a clean re-apply. */
    layoutEpoch: number;
    /** False while a slug id hasn't resolved to a numeric id — Save stays disabled. */
    canSave: boolean;
    saving: boolean;
    saveError: string | null;
    save: (positions: StoredNodePosition[]) => Promise<void>;
    reset: () => void;
    /** Layout extracted from the architecture document's metadata._layout, if present. */
    documentLayout: StoredNodePosition[] | null;
    /** Which layout source is currently active. */
    layoutSource: LayoutSource;
    /** Switch between document and server layout sources. */
    setLayoutSource: (source: LayoutSource) => void;
    /** Whether both document and server layouts are available (show the toggle). */
    hasBothSources: boolean;
}

const LAYOUT_SOURCE_PREFIX = 'calm-hub:layout-source:';

function loadPreferredSource(viewportKey: string | null | undefined): LayoutSource | null {
    if (!viewportKey) return null;
    try {
        return localStorage.getItem(`${LAYOUT_SOURCE_PREFIX}${viewportKey}`) as LayoutSource | null;
    } catch { return null; }
}

function savePreferredSource(viewportKey: string | null | undefined, source: LayoutSource): void {
    if (!viewportKey) return;
    try {
        localStorage.setItem(`${LAYOUT_SOURCE_PREFIX}${viewportKey}`, source);
    } catch { /* ignore */ }
}

const SUPPORTED_TYPES: Partial<Record<string, LayoutResourceType>> = {
    Architectures: 'architectures',
    Patterns: 'patterns',
};

/**
 * Resolves and fetches the shared default layout for an architecture or a
 * pattern, and owns the save/reset actions. Returns an inert result (no
 * fetch, no key) for anything else — dropped files and any other calmType
 * are out of scope for server-side layouts.
 *
 * When `architectureData` includes `metadata._layout`, it is offered as a
 * layout source alongside the server-side saved layout, with a user-selectable
 * toggle when both are available.
 */
export function useDefaultLayout(namespace: string, id: string, calmType: string, architectureData?: Record<string, unknown>): UseDefaultLayoutResult {
    const calmService = useMemo(() => new CalmService(), []);
    const layoutService = useMemo(() => new LayoutService(), []);
    const urlType = SUPPORTED_TYPES[calmType];
    const isSupportedType = urlType !== undefined;

    const [resolvedId, setResolvedId] = useState<number | undefined>(() =>
        isSupportedType && !isSlug(id) ? Number(id) : undefined
    );
    // Tracks slug→numeric resolution specifically, so a slug that fails to
    // resolve can settle `defaultLayout` to `null` (no default, save disabled)
    // instead of leaving the graph waiting on a fetch that will never start —
    // `resolvedId === undefined` alone can't distinguish "still resolving"
    // from "resolution finished but found no match".
    const [resolvingId, setResolvingId] = useState<boolean>(() => isSupportedType && isSlug(id));
    const [defaultLayout, setDefaultLayout] = useState<StoredNodePosition[] | null | undefined>(
        isSupportedType ? undefined : null
    );
    const [layoutEpoch, setLayoutEpoch] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Extract layout from architecture document metadata._layout if present.
    const documentLayout = useMemo<StoredNodePosition[] | null>(() => {
        if (!isSupportedType || !architectureData) return null;
        const metadata = architectureData.metadata;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
        const layoutData = (metadata as Record<string, unknown>)._layout;
        if (!layoutData || typeof layoutData !== 'object' || Array.isArray(layoutData)) return null;
        return layoutMapToStoredPositions(layoutData as LayoutMap);
    }, [isSupportedType, architectureData]);

    // Resolve a slug id to its numeric id once per (namespace, id, calmType).
    useEffect(() => {
        if (!isSupportedType) {
            setResolvedId(undefined);
            setResolvingId(false);
            return;
        }
        if (!isSlug(id)) {
            setResolvedId(Number(id));
            setResolvingId(false);
            return;
        }
        let cancelled = false;
        setResolvedId(undefined);
        setResolvingId(true);
        calmService
            .fetchMappings(namespace, calmType)
            .then((mappings) => {
                if (cancelled) return;
                const match = mappings.find((m) => m.customId === id);
                setResolvedId(match ? match.numericId : undefined);
                setResolvingId(false);
            })
            .catch(() => {
                if (cancelled) return;
                setResolvedId(undefined);
                setResolvingId(false);
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, namespace, id, calmType, isSupportedType]);

    // undefined only while genuinely inapplicable (an unsupported type) or
    // still resolving; once resolution for a supported type has settled
    // without a match, this is null — not undefined — so Drawer's fallback is
    // suppressed rather than silently keying off the raw slug (see
    // viewportKeyOverride's doc).
    const viewportKey =
        resolvedId !== undefined
            ? buildViewportKey(namespace, calmType, resolvedId)
            : isSupportedType && !resolvingId
              ? null
              : undefined;

    // Layout source selection — user can toggle between document and server layouts.
    const [layoutSource, setLayoutSourceState] = useState<LayoutSource>('auto');

    useEffect(() => {
        const saved = loadPreferredSource(viewportKey);
        if (saved) setLayoutSourceState(saved);
        else setLayoutSourceState('auto');
    }, [viewportKey]);

    const setLayoutSource = useCallback((source: LayoutSource) => {
        setLayoutSourceState(source);
        savePreferredSource(viewportKey, source);
        if (viewportKey) clearStoredNodePositions(viewportKey);
        setLayoutEpoch((epoch) => epoch + 1);
    }, [viewportKey]);

    // Fetch the server default once the id is settled (resolved to a number,
    // or resolution finished without a match).
    useEffect(() => {
        if (!isSupportedType) {
            setDefaultLayout(null);
            return;
        }
        if (resolvingId) {
            setDefaultLayout(undefined);
            return;
        }
        if (resolvedId === undefined) {
            // Resolution finished but the slug didn't match anything — nothing
            // to fetch, and nothing to wait on. Never a silent stuck loading
            // state: settle to "no default" so Save disables with a reason.
            setDefaultLayout(null);
            return;
        }
        let cancelled = false;
        setDefaultLayout(undefined);
        layoutService
            .getDefaultLayout(namespace, resolvedId, urlType)
            .then((layout) => {
                if (cancelled) return;
                setDefaultLayout(layout ? apiResponseToStoredPositions(layout as unknown as Record<string, unknown>) : null);
            })
            .catch(() => {
                if (!cancelled) setDefaultLayout(null);
            });
        return () => {
            cancelled = true;
        };
    }, [layoutService, namespace, resolvedId, isSupportedType, resolvingId, urlType]);

    const save = useCallback(
        async (positions: StoredNodePosition[]) => {
            if (resolvedId === undefined || urlType === undefined) return;
            setSaving(true);
            setSaveError(null);
            try {
                const layout: CalmLayout = {
                    for: `/api/calm/namespaces/${namespace}/${urlType}/${resolvedId}`,
                    nodes: storedPositionsToLayoutMap(positions),
                };
                await layoutService.saveDefaultLayout(namespace, resolvedId, layout, urlType);
                if (viewportKey) clearStoredNodePositions(viewportKey);
                setDefaultLayout(positions);
                setLayoutSourceState('server');
                savePreferredSource(viewportKey, 'server');
                setLayoutEpoch((epoch) => epoch + 1);
            } catch (err) {
                setSaveError(err instanceof Error ? err.message : 'Failed to save default layout');
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [resolvedId, urlType, namespace, layoutService, viewportKey]
    );

    const reset = useCallback(() => {
        if (viewportKey) clearStoredNodePositions(viewportKey);
        setSaveError(null);
        setLayoutEpoch((epoch) => epoch + 1);
    }, [viewportKey]);

    const canSave = resolvedId !== undefined;

    // The server-side layout fetched from the API.
    const serverLayout = defaultLayout;

    const hasBothSources = documentLayout != null && serverLayout != null;

    // Resolve which layout to expose as `defaultLayout` based on user selection.
    const effectiveDefaultLayout = useMemo<StoredNodePosition[] | null | undefined>(() => {
        if (layoutSource === 'document' && documentLayout) return documentLayout;
        if (layoutSource === 'server') return serverLayout ?? null;
        // 'auto': prefer document if it exists, else server
        if (documentLayout) return documentLayout;
        return serverLayout;
    }, [layoutSource, documentLayout, serverLayout]);

    // Memoised so consumers that key a useCallback/useMemo off the whole result
    // (e.g. DiagramSection's handleSaveLayout) get a stable reference instead of
    // a fresh object literal — and therefore a fresh dependency — every render.
    return useMemo(
        () => ({
            viewportKey,
            defaultLayout: effectiveDefaultLayout,
            layoutEpoch,
            canSave,
            saving,
            saveError,
            save,
            reset,
            documentLayout,
            layoutSource,
            setLayoutSource,
            hasBothSources,
        }),
        [viewportKey, effectiveDefaultLayout, layoutEpoch, canSave, saving, saveError, save, reset, documentLayout, layoutSource, setLayoutSource, hasBothSources]
    );
}
