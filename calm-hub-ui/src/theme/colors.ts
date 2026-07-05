/**
 * Single source of truth for all colors in calm-hub-ui
 *
 * This file defines all color values used throughout the application.
 * Components should import from this file rather than defining colors inline.
 *
 * Brand colors are also exposed as CSS custom properties via initThemeCssVars()
 * called at app startup, so they can be used in Tailwind/DaisyUI contexts.
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

    // Decision colors for pattern visualization
    decision: {
        oneOf: '#ca8a04', // yellow-600 - "choose exactly one"
        anyOf: '#0284c7', // sky-600 - "choose one or more"
    },

    // Feedback colors (for markers, indicators)
    feedback: {
        positive: '#16a34a', // green-600
        negative: '#dc2626', // red-600
    },

    // Timeline / diff design tokens (CALM Hub timeline + comparison UI).
    // A deliberately separate palette from the wider brand colors so this surface
    // can evolve without affecting the rest of the app.
    calm: {
        blue: '#1f6dff', // primary / active dots / progress / NOW-FROM-TO bg
        blueDeep: '#0a4ad6', // hover / pressed, badge bg, deep label colour
        blueSoft: '#e8f0ff', // CURRENT pill bg, selected-row bg
        teal: '#1aa3b7', // architecture node border (thumbnails)
    },
    ink: {
        900: '#0f172a',
        700: '#334155',
        500: '#64748b',
        400: '#94a3b8',
        300: '#cbd5e1',
        200: '#e2e8f0',
        100: '#f1f5f9',
        50: '#f8fafc',
    },
    timelineBg: '#f6f7f9',
    new: '#ef4444',

    // ── CALM Hub redesign tokens (Phase 1) ────────────────────────────────────
    // Home for the navigation/browse redesign palette. Deliberately ADDITIVE and
    // namespaced under `redesign` so it does not touch the existing global brand
    // (`brand.primary` navy / `brand.accent`) or the logo — `#2563EB` here is the
    // redesign's interaction / selection colour only, per the design handoff.
    // Components in the new rail / namespace / domain surfaces consume hex from
    // here via inline `style`. The one value also needed inside Tailwind
    // pseudo-variants (e.g. `focus-visible:outline-[var(--color-interaction)]`),
    // where inline style can't reach, is `primary` — `initThemeCssVars()` mirrors
    // it as the runtime CSS var `--color-interaction` so there is a single source
    // of truth for the brand interaction blue. Exact hex values are from the spec.
    redesign: {
        // Brand / interaction
        primary: '#2563EB', // active states, selection, links, focus, primary
        activeText: '#1D4ED8', // active tab / rail text
        tintBg: '#EEF4FF', // selected rail row, icon tile, active pill bg
        tint2: '#F8FAFF', // dropzone / welcome hover bg
        // Text scale
        ink: '#0B1220', // H1/H2/H3, node labels
        bodyStrong: '#0F172A', // current breadcrumb segment, strong body
        body: '#41506A', // paragraph copy
        bodyAlt: '#475569', // resting tab text
        muted: '#5A6678', // sub-copy, card descriptions
        mutedAlt: '#64748B', // meta
        faint: '#8A94A6', // mono section labels
        faintAlt: '#9AA6B8', // faint hints (NAMESPACES label colour)
        disabled: '#B6BECC', // zero-count tab text + badge
        // Surfaces / borders
        borderStrong: '#E2E6ED', // inputs, controls, minimap
        border: '#E6E9EE', // cards, rails, top bar, dividers
        tabDivider: '#EAEDF1', // tab bottom border
        canvas: '#F7F8FA', // diagram stage
        surface: '#F8FAFC', // search bg, rail bg
        surfaceAlt: '#FCFCFD', // rail bg, minimap field
        // Resting count-badge bg / text
        badgeBg: '#EEF2F7',
        // Faint count-badge bg for a zero-count (dimmed) tab
        badgeBgFaint: '#F4F6F9',
        // Selected-rail accent (inset left bar)
        railAccentShadow: 'inset 3px 0 0 #2563EB',
    },

    // Resource-type accents (badges, card thumbnails, node borders, type dots).
    // `tint` is the soft badge background per accent. Defined now for later phases.
    resourceTypes: {
        architecture: { accent: '#2563EB', tint: '#EEF4FF' },
        pattern: { accent: '#7C3AED', tint: '#F2ECFD' },
        flow: { accent: '#0891B2', tint: '#E5F6FA' },
        standard: { accent: '#D97706', tint: '#FCF1E2' },
        adr: { accent: '#DB2777', tint: '#FCE9F2' },
        interface: { accent: '#059669', tint: '#E4F5EE' },
    },
    diffPalette: {
        add: { bg: '#e8f6ee', border: '#b6dfc6', fg: '#15803d', sign: '+' },
        mod: { bg: '#fdf3e2', border: '#f3dca4', fg: '#b45309', sign: '~' },
        del: { bg: '#fde8e8', border: '#f1bfbf', fg: '#b91c1c', sign: '−' },
    },
} as const;

export type Colors = typeof colors;

/**
 * Sets CSS custom properties on the document root from colors.brand,
 * so Tailwind/DaisyUI classes can reference them without duplicating values.
 * Call once at app startup (e.g., in index.tsx).
 */
export function initThemeCssVars(): void {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', colors.brand.primary);
    root.style.setProperty('--color-accent', colors.brand.accent);
    root.style.setProperty('--color-accent-light', colors.brand.accentLight);
    // Redesign interaction / selection blue, exposed for Tailwind pseudo-variant
    // arbitraries (focus rings) that can't read an inline style. Single source of
    // truth for `#2563EB`; does NOT touch the navy global `--color-primary`.
    root.style.setProperty('--color-interaction', colors.redesign.primary);
}
