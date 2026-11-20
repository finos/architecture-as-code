// To add a new detailed node icon/card:
// 1. Add the SVG to src/packs/icons/core.ts (or the relevant pack icon file).
// 2. Register the node in src/packs/packs/core.ts (or the relevant pack definition).
// 3. Add or adjust the card sizing/colors here if the default detail card visual is not enough.

export interface DetailNodeVisual {
    defaultBackground: string;
    defaultBorder: string;
    defaultIconColor: string;
    iconSize: number;
    width: number;
    height: number;
}

export interface DetailNodeResizeBounds {
    minWidth: number;
    minHeight: number;
}

export const DEFAULT_DETAIL_NODE_RESIZE_BOUNDS: DetailNodeResizeBounds = {
    minWidth: 40,
    minHeight: 40,
};

export const DEFAULT_DETAIL_NODE_VISUAL: DetailNodeVisual = {
    defaultBackground: '#f8fafc',
    defaultBorder: '#cbd5e1',
    defaultIconColor: '#64748b',
    iconSize: 46,
    width: 200,
    height: 80,
};

export const DETAIL_NODE_VISUALS: Record<string, DetailNodeVisual> = {
    actor: {
        defaultBackground: '#f8fafc',
        defaultBorder: '#333333',
        defaultIconColor: '#333333',
        iconSize: 48,
        width: 200,
        height: 80,
    },
    service: {
        defaultBackground: '#e6f4ea',
        defaultBorder: '#1b7340',
        defaultIconColor: '#1b7340',
        iconSize: 48,
        width: 200,
        height: 80,
    },
    database: {
        defaultBackground: '#e6f4ea',
        defaultBorder: '#1b7340',
        defaultIconColor: '#1b7340',
        iconSize: 50,
        width: 200,
        height: 80,
    },
    webclient: {
        defaultBackground: '#e0f2fe',
        defaultBorder: '#0369a1',
        defaultIconColor: '#0369a1',
        iconSize: 46,
        width: 200,
        height: 80,
    },
    system: DEFAULT_DETAIL_NODE_VISUAL,
    ecosystem: DEFAULT_DETAIL_NODE_VISUAL,
    network: DEFAULT_DETAIL_NODE_VISUAL,
    ldap: DEFAULT_DETAIL_NODE_VISUAL,
    'data-asset': DEFAULT_DETAIL_NODE_VISUAL,
};

export function getDetailNodeVisual(calmType?: string): DetailNodeVisual {
    if (!calmType) return DEFAULT_DETAIL_NODE_VISUAL;
    return DETAIL_NODE_VISUALS[calmType] ?? DEFAULT_DETAIL_NODE_VISUAL;
}

export function getDetailNodeResizeBounds(calmType?: string): DetailNodeResizeBounds {
    if (!calmType) return DEFAULT_DETAIL_NODE_RESIZE_BOUNDS;
    return DETAIL_NODE_VISUALS[calmType] ? DEFAULT_DETAIL_NODE_RESIZE_BOUNDS : DEFAULT_DETAIL_NODE_RESIZE_BOUNDS;
}
