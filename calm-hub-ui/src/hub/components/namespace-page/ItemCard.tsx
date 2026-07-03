import { Link } from 'react-router-dom';
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
     * Overrides the footer mono chip (e.g. a namespace on the landing highlights).
     * When unset the footer falls back to the "N versions" scent or {@link customId}.
     */
    meta?: string;
    /** Thumbnail header height in px (default 96; landing highlights use a shorter one). */
    thumbnailHeight?: number;
    /** `data-testid` for the activation element (default `item-card`). */
    testId?: string;
    /**
     * When set, the whole card is a router {@link Link} to this path — used by cards
     * that navigate to a static route (e.g. a namespace page). When unset the card is
     * a `<button>` calling {@link onActivate} (the detail route needs a per-item version
     * fetch resolved on click, so it can't be a static Link).
     */
    href?: string;
    /** Click handler for the button form; required when {@link href} is not set. */
    onActivate?: () => void;
}

/**
 * A browse card for a single resource: a type-tinted striped thumbnail header, the
 * item name, an optional 2-line-clamped description and a footer {@link TypeBadge}
 * plus a mono meta chip. The name is the activation target — a `<button>` (default)
 * or a router {@link Link} when {@link href} is given — whose stretched `::after`
 * makes the whole card clickable while keeping its accessible name to just the name.
 */
export function ItemCard({
    name,
    description,
    type,
    customId,
    versionCount,
    meta,
    thumbnailHeight = 96,
    testId = 'item-card',
    href,
    onActivate,
}: ItemCardProps) {
    const { accent, tint } = getResourceTypeColors(type);
    // Striped header derived from the type's own tokens (tint + accent at low
    // alpha) rather than hardcoded mockup hexes, so it tracks the palette.
    const stripes = `repeating-linear-gradient(135deg, ${tint}, ${tint} 7px, ${accent}20 7px, ${accent}20 14px)`;

    // A `<button>`/`<a>` can't legally wrap the card's block content (phrasing content
    // only). So the card is a positioned `<article>` and the activation element's
    // `::after` (`after:absolute after:inset-0`) stretches over the whole card to keep
    // the full-card click target, while its accessible name stays just the item name.
    const activationClass =
        "block w-full text-left text-[14px] font-semibold truncate rounded-[2px] no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-interaction)]";

    // Footer chip: an explicit meta override, else the "N versions" scent, else the customId.
    const chip =
        meta !== undefined
            ? meta
            : versionCount !== undefined
              ? `${versionCount} ${versionCount === 1 ? 'version' : 'versions'}`
              : customId;

    return (
        <article
            className="group relative rounded-[12px] overflow-hidden bg-base-100 hover:-translate-y-0.5 hover:shadow-md"
            style={{
                border: `1px solid ${colors.redesign.border}`,
                boxShadow: redesignTokens.shadow.card,
                transition: redesignTokens.transition,
            }}
        >
            <div style={{ height: thumbnailHeight, background: stripes }} />
            <div className="p-[14px]">
                {href ? (
                    <Link to={href} data-testid={testId} className={activationClass} style={{ color: colors.redesign.ink }}>
                        {name}
                    </Link>
                ) : (
                    <button
                        type="button"
                        data-testid={testId}
                        onClick={onActivate}
                        className={activationClass}
                        style={{ color: colors.redesign.ink }}
                    >
                        {name}
                    </button>
                )}
                {description && (
                    <p
                        className="text-[12px] leading-[1.45] mt-[5px] mb-[11px] line-clamp-2"
                        style={{ color: colors.redesign.mutedAlt }}
                    >
                        {description}
                    </p>
                )}
                {/* No stacking context here: the transparent stretched `::after` overlays
                    the footer so a click anywhere on the card activates it. */}
                <div className={`flex items-center gap-2 ${description ? '' : 'mt-[11px]'}`}>
                    <TypeBadge type={type} />
                    {chip !== undefined && (
                        <span
                            className="font-mono-jb text-[10.5px] ml-auto truncate"
                            style={{ color: colors.redesign.mutedAlt }}
                        >
                            {chip}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}
