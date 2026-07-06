import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalmService } from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';
import { NamespaceCounts } from '../../../model/counts.js';
import { resolveResourceDetailPath } from '../tree-navigation/navigation-loaders.js';
import { NamespacePageHeader } from './NamespacePageHeader.js';
import { SegmentedTypeTabs } from './SegmentedTypeTabs.js';
import { ItemCard } from './ItemCard.js';
import { EmptyState } from './EmptyState.js';
import { useNamespaceItems } from './useNamespaceItems.js';
import { useActiveType } from './useActiveType.js';
import {
    type NamespaceResourceType,
    getResourceTypeMeta,
    tabId,
    TYPE_PANEL_ID,
} from './resource-type-meta.js';

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

    const activeItems = useMemo(
        () => groups.find((g) => g.type === active)?.items ?? [],
        [groups, active]
    );

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
