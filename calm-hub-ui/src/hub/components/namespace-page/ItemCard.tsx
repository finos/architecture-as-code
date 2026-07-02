import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { TypeBadge } from './TypeBadge.js';
import { type NamespaceResourceType, getResourceTypeColors } from './resource-type-meta.js';

interface ItemCardProps {
    name: string;
    description?: string;
    type: NamespaceResourceType;
    /** Optional mono identifier (the item's customId / slug) shown in the footer. */
    customId?: string;
    /**
     * Number of stored versions for the item, when the type carries a version map
     * (architectures, patterns, flows, standards). Shown as the footer scent
     * "N versions"; when absent (ADRs/interfaces) the {@link customId} is shown
     * instead.
     */
    versionCount?: number;
    /**
     * Activates the card (opens the item's detail route). The card cannot be a
     * static router `<Link>`: the detail route needs the item's latest version,
     * which is only resolvable via a per-item fetch — so navigation is resolved on
     * click by the parent rather than precomputed, to avoid an N+1 on render.
     */
    onActivate: () => void;
}

/**
 * A browse card for a single namespace item: a type-tinted striped thumbnail
 * header, the item name, a 2-line-clamped description and a footer with its
 * {@link TypeBadge}. The name is a `<button>` whose stretched `::after` makes the
 * whole card the activation target for the item's detail route.
 *
 * The footer meta shows the "N versions" scent when the item carries a version
 * count (the version-map types); otherwise it falls back to the mono customId.
 */
export function ItemCard({ name, description, type, customId, versionCount, onActivate }: ItemCardProps) {
    const { accent, tint } = getResourceTypeColors(type);
    // Striped header derived from the type's own tokens (tint + accent at low
    // alpha) rather than hardcoded mockup hexes, so it tracks the palette.
    const stripes = `repeating-linear-gradient(135deg, ${tint}, ${tint} 7px, ${accent}20 7px, ${accent}20 14px)`;

    // A `<button>` can't legally wrap the card's block content (it takes phrasing
    // content only). So the card is a positioned `<article>` holding the visual
    // content, and a single `<button>` whose `::after` (`after:absolute
    // after:inset-0`) stretches over the whole card to keep the full-card click
    // target. The button's text is just the item name, so its accessible name is
    // the name (not name + description + badge + customId).
    return (
        <article
            className="group relative rounded-[12px] overflow-hidden bg-base-100 hover:-translate-y-0.5 hover:shadow-md"
            style={{
                border: `1px solid ${colors.redesign.border}`,
                boxShadow: redesignTokens.shadow.card,
                transition: redesignTokens.transition,
            }}
        >
            <div style={{ height: 96, background: stripes }} />
            <div className="p-[14px]">
                <button
                    type="button"
                    data-testid="item-card"
                    onClick={onActivate}
                    className="block w-full text-left text-[14px] font-semibold truncate rounded-[2px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-interaction)]"
                    style={{ color: colors.redesign.ink }}
                >
                    {name}
                </button>
                {description && (
                    <p
                        className="text-[12px] leading-[1.45] mt-[5px] mb-[11px] line-clamp-2"
                        style={{ color: colors.redesign.mutedAlt }}
                    >
                        {description}
                    </p>
                )}
                {/* No stacking context here: the button's transparent stretched
                    `::after` overlays the footer so a click anywhere on the card
                    (including over the badge/customId) activates it. */}
                <div className={`flex items-center gap-2 ${description ? '' : 'mt-[11px]'}`}>
                    <TypeBadge type={type} />
                    {/* "N versions" scent for the version-map types; otherwise the
                        customId. A genuine 0 still reads as "0 versions". */}
                    {versionCount !== undefined ? (
                        <span
                            className="font-mono-jb text-[10.5px] ml-auto truncate"
                            style={{ color: colors.redesign.mutedAlt }}
                        >
                            {versionCount} {versionCount === 1 ? 'version' : 'versions'}
                        </span>
                    ) : (
                        customId && (
                            <span
                                className="font-mono-jb text-[10.5px] ml-auto truncate"
                                style={{ color: colors.redesign.mutedAlt }}
                            >
                                {customId}
                            </span>
                        )
                    )}
                </div>
            </div>
        </article>
    );
}
