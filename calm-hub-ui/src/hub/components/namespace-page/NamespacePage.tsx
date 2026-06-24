import { colors } from '../../../theme/colors.js';
import { NamespacePageHeader } from './NamespacePageHeader.js';
import { NamespaceResourceGroup } from './NamespaceResourceGroup.js';
import { useNamespaceItems } from './useNamespaceItems.js';

interface NamespacePageProps {
    namespace: string;
    /** Total artefacts for the header meta (from the counts endpoint). */
    total: number;
}

/**
 * Namespace browse page. Phase 1 = breadcrumb + header chrome over a simple
 * placeholder body: the namespace's items grouped by resource type, each a link
 * into the existing item-detail route, so browse → detail works end-to-end.
 *
 * Phase 2: replace the body with SegmentedTypeTabs + ItemCard grid + EmptyState.
 */
export function NamespacePage({ namespace, total }: NamespacePageProps) {
    const { groups, loading } = useNamespaceItems(namespace);
    const hasAnyItems = groups.some((g) => g.items.length > 0);

    return (
        <div className="h-full overflow-auto bg-base-100" style={{ padding: '32px 40px' }}>
            <NamespacePageHeader namespace={namespace} total={total} />

            {/* Phase 2: replace with SegmentedTypeTabs + ItemCard grid + EmptyState */}
            <div className="mt-8">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <span className="loading loading-spinner loading-md text-base-content/50" />
                    </div>
                ) : !hasAnyItems ? (
                    <p className="text-[14px]" style={{ color: colors.redesign.muted }}>
                        No artefacts in this namespace yet.
                    </p>
                ) : (
                    groups.map((group) => (
                        <NamespaceResourceGroup
                            key={group.type}
                            type={group.type}
                            namespace={namespace}
                            items={group.items}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
