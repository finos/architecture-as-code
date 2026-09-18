import { colors } from '../../../theme/colors.js';

interface NestedCountBadgeProps {
    /** Descendant items hidden under this collapsed row. */
    count: number;
}

/**
 * Ghost `+N` pill shown on a collapsed namespace row for the items hidden
 * beneath it. A distinct component (not a {@link CountBadge} variant) so the
 * existing `data-testid="count-badge"` keeps meaning "this row's own count"
 * everywhere it is asserted.
 */
export function NestedCountBadge({ count }: NestedCountBadgeProps) {
    return (
        <span
            data-testid="nested-count-badge"
            className="font-mono-jb text-[11px] leading-none px-1.5 py-0.5 rounded-md min-w-[20px] text-center inline-block"
            style={{ backgroundColor: colors.redesign.badgeBgFaint, color: colors.redesign.disabled }}
        >
            +{count}
        </span>
    );
}
