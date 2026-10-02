import { THEME } from '../theme.js';
import type { EdgeBadgeStyle } from '../../../contracts/contracts.js';

/**
 * Badge colours for an edge that carries flow or AIGF metadata. An edge with neither has no
 * badge, so flow is the only case that needs telling apart from AIGF.
 */
export function getBadgeStyle(hasFlowInfo: boolean): EdgeBadgeStyle {
    const color = hasFlowInfo ? THEME.colors.accent : THEME.colors.success;
    return {
        background: `${color}20`,
        border: color,
        iconColor: color,
    };
}
