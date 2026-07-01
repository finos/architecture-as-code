import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalmService } from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { NamespaceCounts } from '../../../model/counts.js';
import { resolveResourceDetailPath } from '../tree-navigation/navigation-loaders.js';
import { NamespacePageHeader } from './NamespacePageHeader.js';
import { SegmentedTypeTabs, type TypeTab } from './SegmentedTypeTabs.js';
import { ItemCard } from './ItemCard.js';
import { EmptyState } from './EmptyState.js';
import { useNamespaceItems } from './useNamespaceItems.js';
import {
    NAMESPACE_RESOURCE_TYPES,
    type NamespaceResourceType,
    getResourceTypeMeta,
    tabId,
    TYPE_PANEL_ID,
} from './resource-type-meta.js';
import { mapTypeInUIToTypeInUrl } from '../tree-navigation/navigation-loaders.js';

interface NamespacePageProps {
    namespace: string;
    /**
     * Per-type + total counts for this namespace, or `undefined` while the counts
     * endpoint is still loading. `undefined` (loading) is kept distinct from a
     * known all-zero record so the tabs render resting rather than dimmed and the
     * default type isn't committed to a non-Architectures value prematurely.
     */
    counts?: NamespaceCounts;
}

/** Maps each browse type to its field on the counts payload. */
const COUNT_FIELD: Record<NamespaceResourceType, keyof NamespaceCounts> = {
    Architectures: 'architectures',
    Patterns: 'patterns',
    Flows: 'flows',
    Standards: 'standards',
    ADRs: 'adrs',
    Interfaces: 'interfaces',
};

/** Resolves the `?type=` param to a valid browse type, defaulting deterministically. */
function useActiveType(counts: NamespaceCounts | undefined): {
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

/**
 * Namespace browse page: breadcrumb + header, a segmented type tab bar (URL-backed
 * via `?type=`), and a responsive card grid of the active type's items. An empty
 * type renders an {@link EmptyState} in the grid area. Tab counts come from the
 * namespace's counts (passed in — no extra fetch); items come from
 * {@link useNamespaceItems}.
 */
export function NamespacePage({ namespace, counts }: NamespacePageProps) {
    const { groups, loading } = useNamespaceItems(namespace);
    const { active, select, tabs } = useActiveType(counts);
    const countsLoading = counts === undefined;

    const navigate = useNavigate();
    const calmService = useMemo(() => new CalmService(), []);
    const adrService = useMemo(() => new AdrService(), []);

    // Resolve the item's detail route (latest version) on click. Done here rather
    // than precomputed per card to avoid an N+1 fetch on render.
    const openItem = useCallback(
        async (type: NamespaceResourceType, id: string) => {
            try {
                const path = await resolveResourceDetailPath(id, type, namespace, calmService, adrService);
                if (path) {
                    navigate(path);
                } else {
                    // No published version to route to. arg is %s to avoid format-string injection from `id`.
                    console.warn('No openable version for %s; nothing to navigate to', id);
                }
            } catch (err) {
                console.error('Failed to open %s', id, err);
            }
        },
        [namespace, calmService, adrService, navigate]
    );

    const activeItems = groups.find((g) => g.type === active)?.items ?? [];

    return (
        <div className="h-full overflow-auto bg-base-100" style={{ padding: '32px 40px' }}>
            <NamespacePageHeader namespace={namespace} total={counts?.total} />

            <div className="mt-6">
                <SegmentedTypeTabs types={tabs} active={active} onSelect={select} />
            </div>

            <div className="mt-6" role="tabpanel" id={TYPE_PANEL_ID} aria-labelledby={tabId(active)}>
                {/* Hold the spinner until both counts and items resolve: the active
                    type can flip once counts arrive, so showing items keyed off the
                    held default would flash the wrong (often empty) grid for a beat. */}
                {loading || countsLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <span className="loading loading-spinner loading-md text-base-content/50" />
                    </div>
                ) : activeItems.length === 0 ? (
                    <EmptyState
                        message={`No ${getResourceTypeMeta(active).pluralLabel} in this namespace yet`}
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeItems.map((item) => (
                            <ItemCard
                                key={`${active}-${item.id}`}
                                name={item.name}
                                description={item.description}
                                type={active}
                                customId={item.customId}
                                versionCount={item.versionCount}
                                onActivate={() => openItem(active, item.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
