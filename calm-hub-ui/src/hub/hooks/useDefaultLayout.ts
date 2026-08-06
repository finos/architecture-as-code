import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalmService } from '../../service/calm-service.js';
import { LayoutService } from '../../service/layout-service.js';
import { isSlug } from '../../model/calm.js';
import { CalmLayout, pinsToStoredPositions, storedPositionsToPins } from '../../model/layout.js';
import { clearStoredNodePositions, StoredNodePosition } from '../../visualizer/services/node-position-service.js';

export interface UseDefaultLayoutResult {
    /**
     * Namespace + resolved numeric architecture id — the single key both the
     * localStorage scratch layer and the server layout are addressed by, so a
     * diagram reached via a slug route and via its numeric route share one
     * scratch entry and one server call. Three states:
     *  - a string: the resolved key.
     *  - `undefined`: not applicable (a pattern or dropped file), or a slug that
     *    is still resolving — callers with a loading state to show key off this.
     *  - `null`: this *is* an architecture, but resolution finished without a
     *    numeric id (an unresolvable slug, or the mapping fetch failed). Never
     *    `undefined` here — a caller that fell back to some other key (e.g. the
     *    raw slug) in this state would reintroduce the exact split this key
     *    exists to prevent. See `Drawer`'s `viewportKeyOverride` handling.
     */
    viewportKey: string | null | undefined;
    /** undefined = loading, null = none stored, else the resolved default layout. */
    defaultLayout: StoredNodePosition[] | null | undefined;
    /** Bumped after a successful save or a reset, to force a clean re-apply. */
    layoutEpoch: number;
    /** False while a slug id hasn't resolved to a numeric architecture id — Save stays disabled. */
    canSave: boolean;
    saving: boolean;
    saveError: string | null;
    save: (positions: StoredNodePosition[]) => Promise<void>;
    reset: () => void;
}

/**
 * Resolves and fetches the shared default layout for an architecture, and owns
 * the save/reset actions. Returns an inert result (no fetch, no key) for
 * anything that isn't an architecture — patterns and dropped files are out of
 * scope for server-side layouts in v1.
 */
export function useDefaultLayout(namespace: string, id: string, calmType: string): UseDefaultLayoutResult {
    const calmService = useMemo(() => new CalmService(), []);
    const layoutService = useMemo(() => new LayoutService(), []);
    const isArchitecture = calmType === 'Architectures';

    const [architectureId, setArchitectureId] = useState<number | undefined>(() =>
        isArchitecture && !isSlug(id) ? Number(id) : undefined
    );
    // Tracks slug→numeric resolution specifically, so a slug that fails to
    // resolve can settle `defaultLayout` to `null` (no default, save disabled)
    // instead of leaving the graph waiting on a fetch that will never start —
    // `architectureId === undefined` alone can't distinguish "still resolving"
    // from "resolution finished but found no match".
    const [resolvingId, setResolvingId] = useState<boolean>(() => isArchitecture && isSlug(id));
    const [defaultLayout, setDefaultLayout] = useState<StoredNodePosition[] | null | undefined>(
        isArchitecture ? undefined : null
    );
    const [layoutEpoch, setLayoutEpoch] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Resolve a slug id to its numeric architecture id once per (namespace, id).
    useEffect(() => {
        if (!isArchitecture) {
            setArchitectureId(undefined);
            setResolvingId(false);
            return;
        }
        if (!isSlug(id)) {
            setArchitectureId(Number(id));
            setResolvingId(false);
            return;
        }
        let cancelled = false;
        setArchitectureId(undefined);
        setResolvingId(true);
        calmService
            .fetchMappings(namespace, 'Architectures')
            .then((mappings) => {
                if (cancelled) return;
                const match = mappings.find((m) => m.customId === id);
                setArchitectureId(match ? match.numericId : undefined);
                setResolvingId(false);
            })
            .catch(() => {
                if (cancelled) return;
                setArchitectureId(undefined);
                setResolvingId(false);
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, namespace, id, isArchitecture]);

    // undefined only while genuinely inapplicable (not an architecture) or still
    // resolving; once resolution for an architecture has settled without a
    // match, this is null — not undefined — so Drawer's fallback is suppressed
    // rather than silently keying off the raw slug (see viewportKeyOverride's doc).
    const viewportKey =
        architectureId !== undefined
            ? `${namespace}/${architectureId}`
            : isArchitecture && !resolvingId
              ? null
              : undefined;

    // Fetch the server default once the architecture id is settled (resolved
    // to a number, or resolution finished without a match).
    useEffect(() => {
        if (!isArchitecture) {
            setDefaultLayout(null);
            return;
        }
        if (resolvingId) {
            setDefaultLayout(undefined);
            return;
        }
        if (architectureId === undefined) {
            // Resolution finished but the slug didn't match anything — nothing
            // to fetch, and nothing to wait on. Never a silent stuck loading
            // state: settle to "no default" so Save disables with a reason.
            setDefaultLayout(null);
            return;
        }
        let cancelled = false;
        setDefaultLayout(undefined);
        layoutService
            .getDefaultLayout(namespace, architectureId)
            .then((layout) => {
                if (cancelled) return;
                setDefaultLayout(layout ? pinsToStoredPositions(layout) : null);
            })
            .catch(() => {
                if (!cancelled) setDefaultLayout(null);
            });
        return () => {
            cancelled = true;
        };
    }, [layoutService, namespace, architectureId, isArchitecture, resolvingId]);

    const save = useCallback(
        async (positions: StoredNodePosition[]) => {
            if (architectureId === undefined) return;
            setSaving(true);
            setSaveError(null);
            try {
                const layout: CalmLayout = {
                    for: `/api/calm/namespaces/${namespace}/architectures/${architectureId}`,
                    pins: storedPositionsToPins(positions),
                };
                await layoutService.saveDefaultLayout(namespace, architectureId, layout);
                if (viewportKey) clearStoredNodePositions(viewportKey);
                setDefaultLayout(positions);
                setLayoutEpoch((epoch) => epoch + 1);
            } catch (err) {
                setSaveError(err instanceof Error ? err.message : 'Failed to save default layout');
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [architectureId, namespace, layoutService, viewportKey]
    );

    const reset = useCallback(() => {
        if (viewportKey) clearStoredNodePositions(viewportKey);
        setSaveError(null);
        setLayoutEpoch((epoch) => epoch + 1);
    }, [viewportKey]);

    const canSave = architectureId !== undefined;

    // Memoised so consumers that key a useCallback/useMemo off the whole result
    // (e.g. DiagramSection's handleSaveLayout) get a stable reference instead of
    // a fresh object literal — and therefore a fresh dependency — every render.
    return useMemo(
        () => ({
            viewportKey,
            defaultLayout,
            layoutEpoch,
            canSave,
            saving,
            saveError,
            save,
            reset,
        }),
        [viewportKey, defaultLayout, layoutEpoch, canSave, saving, saveError, save, reset]
    );
}
