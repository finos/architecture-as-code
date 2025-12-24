import { ThemeColors } from '../../types';

/**
 * Light theme - default color palette matching original hardcoded colors
 */
export const lightTheme: ThemeColors = {
    boundary: {
        fill: '#f8fafc',
        stroke: '#64748b',
        strokeWidth: 2,
        strokeDasharray: '5 4',
    },
    node: {
        fill: '#ffffff',
        stroke: '#1f2937',
        strokeWidth: 1,
    },
    iface: {
        fill: '#f1f5f9',
        stroke: '#64748b',
        strokeWidth: 1,
        fontSize: '10px',
    },
    highlight: {
        fill: '#fef3c7',
        stroke: '#f59e0b',
        strokeWidth: 2,
    },
    actor: {
        fill: '#e3f2fd',
        stroke: '#1976d2',
        strokeWidth: 2,
    },
    database: {
        fill: '#fff3e0',
        stroke: '#f57c00',
        strokeWidth: 2,
    },
    webclient: {
        fill: '#f3e5f5',
        stroke: '#7b1fa2',
        strokeWidth: 2,
    },
    service: {
        fill: '#e8f5e8',
        stroke: '#388e3c',
        strokeWidth: 2,
    },
    messagebus: {
        fill: '#fce4ec',
        stroke: '#c2185b',
        strokeWidth: 2,
    },
    system: {
        fill: '#fff8e1',
        stroke: '#f9a825',
        strokeWidth: 2,
    },
};

/**
 * Dark theme - optimized for dark mode displays
 */
export const darkTheme: ThemeColors = {
    boundary: {
        fill: '#1e293b',
        stroke: '#94a3b8',
        strokeWidth: 2,
        strokeDasharray: '5 4',
    },
    node: {
        fill: '#0f172a',
        stroke: '#cbd5e1',
        strokeWidth: 1,
    },
    iface: {
        fill: '#334155',
        stroke: '#94a3b8',
        strokeWidth: 1,
        fontSize: '10px',
    },
    highlight: {
        fill: '#854d0e',
        stroke: '#fbbf24',
        strokeWidth: 2,
    },
    actor: {
        fill: '#1e3a8a',
        stroke: '#60a5fa',
        strokeWidth: 2,
    },
    database: {
        fill: '#78350f',
        stroke: '#fb923c',
        strokeWidth: 2,
    },
    webclient: {
        fill: '#581c87',
        stroke: '#c084fc',
        strokeWidth: 2,
    },
    service: {
        fill: '#14532d',
        stroke: '#4ade80',
        strokeWidth: 2,
    },
    messagebus: {
        fill: '#831843',
        stroke: '#f472b6',
        strokeWidth: 2,
    },
    system: {
        fill: '#713f12',
        stroke: '#fbbf24',
        strokeWidth: 2,
    },
};

/**
 * High-contrast theme - accessibility-focused with strong color differentiation
 */
export const highContrastTheme: ThemeColors = {
    boundary: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 3,
        strokeDasharray: '5 4',
    },
    node: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
    },
    iface: {
        fill: '#e0e0e0',
        stroke: '#000000',
        strokeWidth: 2,
        fontSize: '10px',
    },
    highlight: {
        fill: '#ffff00',
        stroke: '#000000',
        strokeWidth: 3,
    },
    actor: {
        fill: '#cce5ff',
        stroke: '#0000ff',
        strokeWidth: 3,
    },
    database: {
        fill: '#ffe5cc',
        stroke: '#ff6600',
        strokeWidth: 3,
    },
    webclient: {
        fill: '#e5ccff',
        stroke: '#6600ff',
        strokeWidth: 3,
    },
    service: {
        fill: '#ccffcc',
        stroke: '#009900',
        strokeWidth: 3,
    },
    messagebus: {
        fill: '#ffccee',
        stroke: '#cc0066',
        strokeWidth: 3,
    },
    system: {
        fill: '#ffffcc',
        stroke: '#cc9900',
        strokeWidth: 3,
    },
};

/**
 * Get a theme by preset name
 */
export function getThemeByName(name: 'light' | 'dark' | 'high-contrast'): ThemeColors {
    switch (name) {
    case 'dark':
        return darkTheme;
    case 'high-contrast':
        return highContrastTheme;
    case 'light':
    default:
        return lightTheme;
    }
}
