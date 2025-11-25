/**
 * Single source of truth for all colors in calm-hub-ui
 *
 * This file defines all color values used throughout the application.
 * Components should import from this file rather than defining colors inline.
 *
 * Note: ReactFlow and inline styles need direct hex values because:
 * 1. They can't use CSS variables in some contexts (e.g., SVG markers)
 * 2. We need to create transparent variants (e.g., `${color}20`)
 */

export const colors = {
    // Brand colors
    brand: {
        primary: '#000063',
        accent: '#007dff',
        accentLight: '#b2d8f5',
    },

    // Background colors
    background: {
        base: '#ffffff',
        secondary: '#f8fafc', // slate-50
        tertiary: '#f1f5f9', // slate-100
        card: '#ffffff',
    },

    // Text colors
    text: {
        primary: '#1e293b', // slate-800
        secondary: '#64748b', // slate-500
        muted: '#94a3b8', // slate-400
    },

    // Border colors
    border: {
        default: '#e2e8f0', // slate-200
        dark: '#cbd5e1', // slate-300
    },

    // Node type colors for architecture visualization
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

    // Risk level colors
    risk: {
        critical: '#dc2626', // red-600
        high: '#ea580c', // orange-600
        medium: '#ca8a04', // yellow-600
        low: '#16a34a', // green-600
    },

    // Status colors
    status: {
        success: '#16a34a', // green-600
        warning: '#ca8a04', // yellow-600
        error: '#dc2626', // red-600
        info: '#0284c7', // sky-600
    },

    // ADR (Architecture Decision Record) status colors
    adrStatus: {
        draft: '#f97316', // orange-500
        proposed: '#14b8a6', // teal-500
        accepted: '#84cc16', // lime-500
        superseded: '#8b5cf6', // violet-500
        rejected: '#ef4444', // red-500
        deprecated: '#64748b', // slate-500
    },

    // Edge/relationship colors for visualization
    edge: {
        default: '#94a3b8', // slate-400
        selected: '#007dff', // accent
        interacts: '#8b5cf6', // violet-500
        backward: '#a855f7', // purple-500
    },

    // Group/container colors for visualization
    group: {
        background: '#f8fafc', // slate-50
        border: '#cbd5e1', // slate-300
        label: '#64748b', // slate-500
    },

    // Feedback colors (for markers, indicators)
    feedback: {
        positive: '#16a34a', // green-600
        negative: '#dc2626', // red-600
    },
} as const;

export type Colors = typeof colors;
