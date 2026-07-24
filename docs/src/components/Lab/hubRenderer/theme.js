// Ported from calm-hub-ui/src/visualizer/components/reactflow/theme.ts (commit e7d692b3),
// with the neutral tokens resolved to the lab's dark chassis palette instead of
// the Hub's CSS variables (the lab is theme-invariant dark), and the chromatic
// node-type/edge hues copied from calm-hub-ui/src/theme/colors.ts.
// Keep logic in sync until the shared renderer package extraction.

export const THEME = {
    colors: {
        // Brand colors. `accent` is the chromatic value used for edge strokes,
        // solid fills and `${accent}20` tints. The lab uses its chassis accent.
        primary: '#0b1030',
        accent: '#4da3ff',
        accentText: '#4da3ff',
        accentLight: '#b2d8f5',

        // Background colors (lab chassis palette)
        background: '#0b1030',
        backgroundSecondary: '#0d1436',
        card: '#0d1436',

        // Text colors
        foreground: '#c7d0f0',
        muted: '#8b96c9',
        mutedForeground: '#8b96c9',

        // Border colors
        border: '#222a5c',
        borderDark: '#1b2350',

        // Node type colors (chromatic hues from the Hub theme)
        nodeTypes: {
            actor: '#8b5cf6', // violet-500
            ecosystem: '#0ea5e9', // sky-500
            system: '#3b82f6', // blue-500
            service: '#06b6d4', // cyan-500
            database: '#10b981', // emerald-500
            network: '#f59e0b', // amber-500
            ldap: '#a855f7', // purple-500
            webclient: '#0891b2', // cyan-600
            'data-asset': '#14b8a6', // teal-500
            interface: '#d946ef', // fuchsia-500
            'external-service': '#ec4899', // pink-500
            default: '#64748b', // slate-500
        },

        // Status colors
        success: '#22d3a7',
        warning: '#e8a13c',
        error: '#ff7b8a',
        info: '#4da3ff',

        // Edge colors
        edge: {
            selected: '#4da3ff',
            interacts: '#8b5cf6', // violet-500
            backward: '#a855f7', // purple-500
        },

        // Group/container colors (translucent on the dark chassis)
        group: {
            background: 'rgba(77, 163, 255, 0.06)',
            border: 'rgba(77, 163, 255, 0.45)',
            label: '#c7d0f0',
        },
    },

    // Shadow definitions
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.25)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.35), 0 2px 4px -2px rgb(0 0 0 / 0.35)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.45), 0 4px 6px -4px rgb(0 0 0 / 0.45)',
    },
};

/**
 * Get the color for a specific node type
 * (ported from calm-hub-ui/src/theme/helpers.ts)
 */
export function getNodeTypeColor(nodeType) {
    const type = nodeType.toLowerCase();
    return THEME.colors.nodeTypes[type] || THEME.colors.nodeTypes.default;
}
