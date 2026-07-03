import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NamespaceCounts } from '../../../model/counts.js';
import { mapTypeInUIToTypeInUrl } from '../tree-navigation/navigation-loaders.js';
import { type TypeTab } from './SegmentedTypeTabs.js';
import { NAMESPACE_RESOURCE_TYPES, type NamespaceResourceType, COUNT_FIELD } from './resource-type-meta.js';

/**
 * Resolves the `?type=` param to a valid browse type, defaulting deterministically,
 * and exposes the per-type tabs. Kept in its own hook (not inline in NamespacePage)
 * per the component-decomposition rule.
 */
export function useActiveType(counts: NamespaceCounts | undefined): {
    active: NamespaceResourceType;
    select: (type: NamespaceResourceType) => void;
    tabs: TypeTab[];
} {
    const [searchParams, setSearchParams] = useSearchParams();

    // While counts are loading (`undefined`) each tab's count is `undefined` too, so
    // SegmentedTypeTabs renders them resting rather than dimming true-zero tabs.
    const tabs = useMemo<TypeTab[]>(
        () =>
            NAMESPACE_RESOURCE_TYPES.map((type) => ({
                type,
                count: counts ? (counts[COUNT_FIELD[type]] as number) : undefined,
            })),
        [counts]
    );

    // Default: first type with items, else Architectures. Only applied once counts
    // have loaded — while loading we hold Architectures without committing a
    // non-Architectures default, so the active underline never jumps mid-load. The
    // counts are server data available synchronously once resolved, so the active
    // tab is stable before the items fetch resolves — no flash and no URL churn.
    const defaultType = useMemo<NamespaceResourceType>(
        () => tabs.find((t) => (t.count ?? 0) > 0)?.type ?? 'Architectures',
        [tabs]
    );

    const paramValue = searchParams.get('type');
    const active = useMemo<NamespaceResourceType>(() => {
        const match = NAMESPACE_RESOURCE_TYPES.find((t) => mapTypeInUIToTypeInUrl(t) === paramValue);
        return match ?? defaultType;
    }, [paramValue, defaultType]);

    // Replace (not push) so paging through tabs doesn't pollute browser history —
    // Back returns to the previous page, not the previously viewed type.
    const select = useCallback(
        (type: NamespaceResourceType) => {
            const next = new URLSearchParams(searchParams);
            next.set('type', mapTypeInUIToTypeInUrl(type));
            setSearchParams(next, { replace: true });
        },
        [searchParams, setSearchParams]
    );

    return { active, select, tabs };
}
