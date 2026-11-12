import { onSurface, theme } from '../../canvas/theme-colors';
import type { CanvasNodeColours } from '../types';

export const SERVICE_FILL = onSurface(theme.green, 22);
export const WEBCLIENT_FILL = onSurface(theme.blue, 22);
export const DATABASE_FILL = onSurface(theme.green, 28);

/** Node types that draw a standard node in the badge colours. */
const BLOCK_TYPES = new Set(['service', 'webclient', 'system', 'ecosystem', 'network', 'ldap', 'data-asset', 'extension']);

export type NodeColours = CanvasNodeColours;

/** The defaults used by the appearance picker, as CSS values. */
export function defaultNodeColours(
    type: string | undefined,
    isBlock: boolean,
    useTypeDefaults = true,
): NodeColours {
    if (isBlock && (!type || BLOCK_TYPES.has(type))) {
        return { background: theme.badgeBg, text: theme.badgeFg };
    }
    if (!useTypeDefaults) {
        return { background: type === 'container' ? theme.bg : theme.bgWidget, text: theme.text };
    }
    switch (type) {
        case 'service': return { background: SERVICE_FILL, text: theme.text };
        case 'webclient': return { background: WEBCLIENT_FILL, text: theme.text };
        case 'database': return { background: DATABASE_FILL, text: theme.text };
        case 'container': return { background: theme.bg, text: theme.text };
        default: return { background: theme.bgWidget, text: theme.text };
    }
}