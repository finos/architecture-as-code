import { colors } from '../../../theme/colors.js';

interface CountBadgeProps {
    count: number;
    /** When the badge sits on an active surface it fills blue with white text. */
    active?: boolean;
}

/**
 * Mono pill showing an integer. Grey resting; filled-blue on an active surface.
 * Used by rail rows (and, in later phases, the segmented type tabs).
 */
export function CountBadge({ count, active = false }: CountBadgeProps) {
    const style = active
        ? { backgroundColor: colors.redesign.primary, color: '#ffffff' }
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
