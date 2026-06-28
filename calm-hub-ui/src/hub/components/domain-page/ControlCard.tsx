import { IoShieldCheckmarkOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';

interface ControlCardProps {
    name: string;
    description?: string;
    /** The control's numeric id, shown as the mono footer meta (`#5`). */
    controlId: number;
    /** Whether this control's detail panel is currently open (selected styling). */
    active?: boolean;
    /** Activates the card — opens the control's detail panel. */
    onActivate: () => void;
}

/**
 * A browse card for a single control in a domain — the control-domain counterpart
 * of {@link import('../namespace-page/ItemCard.js').ItemCard}. A shield-motif
 * tinted header marks it as a control, then the control name, a 2-line-clamped
 * description and a footer with a "Control" pill plus the mono control id.
 *
 * Matches ItemCard's anatomy (striped header / name / clamped description /
 * footer) and full-card click: the name is a `<button>` whose stretched `::after`
 * (`after:absolute after:inset-0`) makes the whole card the activation target,
 * loading the control via the existing `onControlLoad` flow.
 */
export function ControlCard({ name, description, controlId, active = false, onActivate }: ControlCardProps) {
    const accent = colors.redesign.primary;
    const tint = colors.redesign.tintBg;
    // Striped header from the redesign primary tokens (tint + accent at low alpha),
    // mirroring ItemCard so the control browse grid reads as the same family.
    const stripes = `repeating-linear-gradient(135deg, ${tint}, ${tint} 7px, ${accent}20 7px, ${accent}20 14px)`;

    return (
        <article
            className="group relative rounded-[12px] overflow-hidden bg-base-100 hover:-translate-y-0.5 hover:shadow-md"
            style={{
                // Selected card mirrors the diagram's selected-node treatment: a
                // 2px interaction-blue outline + elevated shadow while its panel is open.
                border: `1px solid ${active ? accent : colors.redesign.border}`,
                boxShadow: active ? redesignTokens.shadow.floating : redesignTokens.shadow.card,
                outline: active ? `2px solid ${accent}` : undefined,
                outlineOffset: active ? '1px' : undefined,
                transition: redesignTokens.transition,
            }}
        >
            <div className="flex items-center justify-center" style={{ height: 96, background: stripes }}>
                <IoShieldCheckmarkOutline size={30} style={{ color: accent, opacity: 0.55 }} />
            </div>
            <div className="p-[14px]">
                <button
                    type="button"
                    data-testid="control-card"
                    aria-pressed={active}
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
                {/* The button's transparent stretched `::after` overlays this footer,
                    so a click anywhere on the card activates it. */}
                <div className={`flex items-center gap-2 ${description ? '' : 'mt-[11px]'}`}>
                    <span
                        className="inline-block text-[11px] leading-none rounded-full px-2 py-1 whitespace-nowrap"
                        style={{ backgroundColor: tint, color: accent }}
                    >
                        Control
                    </span>
                    <span
                        className="font-mono-jb text-[10.5px] ml-auto truncate"
                        style={{ color: colors.redesign.mutedAlt }}
                    >
                        #{controlId}
                    </span>
                </div>
            </div>
        </article>
    );
}
