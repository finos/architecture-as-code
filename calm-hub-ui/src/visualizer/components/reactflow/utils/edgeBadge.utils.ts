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
    return {
        background: `${THEME.colors.muted}20`,
        border: THEME.colors.muted,
        iconColor: THEME.colors.muted,
    };
}
