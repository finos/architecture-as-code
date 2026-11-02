import { onSurface, theme } from './theme-colors';

export const SERVICE_FILL = onSurface(theme.green, 22);
export const WEBCLIENT_FILL = onSurface(theme.blue, 22);
export const DATABASE_FILL = onSurface(theme.green, 28);

export interface NodeColours {
    background: string;
    text: string;
}

/**
 * The colours a node is drawn with when it has no appearance override, as CSS values. The
 * appearance picker starts from these, so they must match the node components.
 */
export function defaultNodeColours(type: string | undefined): NodeColours {
    switch (type) {
        case 'service': return { background: SERVICE_FILL, text: theme.text };
        case 'webclient': return { background: WEBCLIENT_FILL, text: theme.text };
        case 'database': return { background: DATABASE_FILL, text: theme.text };
        // A container has no fill of its own, so the canvas shows through.
        case 'container': return { background: theme.bg, text: theme.text };
        default: return { background: theme.bgWidget, text: theme.text };
    }
}
