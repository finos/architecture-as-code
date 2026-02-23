/**
 * Theme constants for ReactFlow graph visualization
 *
 * This file provides the THEME object used by ReactFlow components.
 * All colors are imported from the central theme (src/theme/colors.ts).
 */

import { colors } from '../../../theme/colors.js';

export const THEME = {
    colors: {
        // Brand colors
        primary: colors.brand.primary,
        accent: colors.brand.accent,
        accentLight: colors.brand.accentLight,

        // Background colors
        background: colors.background.base,
        backgroundSecondary: colors.background.secondary,
        card: colors.background.card,

        // Text colors
        foreground: colors.text.primary,
        muted: colors.text.secondary,
        mutedForeground: colors.text.muted,

        // Border colors
        border: colors.border.default,
        borderDark: colors.border.dark,

        // Node type colors
        nodeTypes: colors.nodeTypes,

        // Risk level colors
        risk: colors.risk,

        // Status colors
        success: colors.status.success,
        warning: colors.status.warning,
        error: colors.status.error,
        info: colors.status.info,

        // Edge colors
        edge: colors.edge,

        // Group/container colors
        group: colors.group,
    },

    // Shadow definitions
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
} as const;

// Re-export helper functions from central theme
export { getNodeTypeColor, getRiskLevelColor } from '../../../theme/helpers.js';
