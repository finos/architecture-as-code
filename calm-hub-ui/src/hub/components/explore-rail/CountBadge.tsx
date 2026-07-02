import { colors } from '../../../theme/colors.js';

interface CountBadgeProps {
    count: number;
    /** When the badge sits on an active surface it fills blue with white text. */
    active?: boolean;
    /**
     * Dimmed (faint bg + disabled text) for a zero-count surface — e.g. an empty
     * type tab that stays visible but reads as "empty, not broken". Ignored when
     * `active` is set. Defaults off so existing rail rows are unchanged.
     */
    dimmed?: boolean;
}

/**
 * Mono pill showing an integer. Grey resting; filled-blue on an active surface;
 * dimmed (faint) for a zero-count surface. Used by rail rows and the segmented
 * type tabs.
 */
export function CountBadge({ count, active = false, dimmed = false }: CountBadgeProps) {
    const style = active
        ? { backgroundColor: colors.redesign.primary, color: '#ffffff' }
        : dimmed
          ? { backgroundColor: colors.redesign.badgeBgFaint, color: colors.redesign.disabled }
          : { backgroundColor: colors.redesign.badgeBg, color: colors.redesign.mutedAlt };

    return (
        <span
            data-testid="count-badge"
            className="font-mono-jb text-[11px] leading-none px-1.5 py-0.5 rounded-md min-w-[20px] text-center inline-block"
            style={style}
        >
            {count}
        </span>
    );
}
