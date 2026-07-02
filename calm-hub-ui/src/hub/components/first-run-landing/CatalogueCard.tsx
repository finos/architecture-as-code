import { Link } from 'react-router-dom';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { TypeBadge } from '../namespace-page/TypeBadge.js';
import { getResourceTypeColors } from '../namespace-page/resource-type-meta.js';
import type { CatalogueHighlight } from './useCatalogueHighlights.js';

interface CatalogueCardProps {
    item: CatalogueHighlight;
}

/**
 * A compact catalogue-highlight card for the landing's "Browse the catalogue"
 * strip: a type-tinted striped thumbnail, the item name, a resource-type
 * {@link TypeBadge} and a mono namespace chip. Thumbnail tint and badge are
 * driven by the item's own type, so architectures and patterns read distinctly.
 *
 * It links to the item's namespace page (not its detail route): the detail route
 * needs the latest version, which is only resolvable via a per-item fetch — an
 * N+1 the landing must avoid. The namespace page resolves the version on click.
 */
export function CatalogueCard({ item }: CatalogueCardProps) {
    const { accent, tint } = getResourceTypeColors(item.type);
    const stripes = `repeating-linear-gradient(135deg, ${tint}, ${tint} 7px, ${accent}20 7px, ${accent}20 14px)`;
    const tabParam = item.type === 'Patterns' ? 'patterns' : 'architectures';

    return (
        <Link
            to={`/namespace/${item.namespace}?type=${tabParam}`}
            data-testid="catalogue-card"
            className="group relative block rounded-[12px] overflow-hidden bg-base-100 no-underline hover:-translate-y-0.5 hover:shadow-md"
            style={{
                border: `1px solid ${colors.redesign.border}`,
                boxShadow: redesignTokens.shadow.card,
                transition: redesignTokens.transition,
            }}
        >
            <div style={{ height: 64, background: stripes }} />
            <div className="p-[14px]">
                <div
                    className="text-[13px] font-semibold truncate"
                    style={{ color: colors.redesign.ink }}
                >
                    {item.name}
                </div>
                <div className="flex items-center gap-2 mt-[11px]">
                    <TypeBadge type={item.type} />
                    <span
                        className="font-mono-jb text-[10.5px] ml-auto truncate"
                        style={{ color: colors.redesign.mutedAlt }}
                    >
                        {item.namespace}
                    </span>
                </div>
            </div>
        </Link>
    );
}
