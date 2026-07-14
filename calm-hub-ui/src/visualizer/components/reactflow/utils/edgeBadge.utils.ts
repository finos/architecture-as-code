import { THEME } from '../theme.js';
import type { EdgeBadgeStyle } from '../../../contracts/contracts.js';

export function getBadgeStyle(hasFlowInfo: boolean, hasAIGF: boolean): EdgeBadgeStyle {
    if (hasFlowInfo) {
        return {
            background: `${THEME.colors.accent}20`,
            border: THEME.colors.accent,
            iconColor: THEME.colors.accent,
        };
    }
    if (hasAIGF) {
        return {
            background: `${THEME.colors.success}20`,
            border: THEME.colors.success,
            iconColor: THEME.colors.success,
        };
    }
    // `muted` is a theme var, so it can't take the `${hex}20` alpha suffix the
    // chromatic branches above use. 0x20/0xff is 12.5%.
    return {
        background: `color-mix(in srgb, ${THEME.colors.muted} 12.5%, transparent)`,
        border: THEME.colors.muted,
        iconColor: THEME.colors.muted,
    };
}
