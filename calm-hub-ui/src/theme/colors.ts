/**
 * Single source of truth for all colors in calm-hub-ui
 *
 * This file defines all color values used throughout the application.
 * Components should import from this file rather than defining colors inline.
 *
 * Values come in two flavours, and which one a token gets is not a style choice:
 *
 * 1. Neutrals (surfaces, text, borders, washes) are `var(--calm-…)` strings, defined
 *    per theme in ./theme.css. Inline styles resolve them against the active
 *    `data-theme`, so a component that reads from here follows the theme for free.
 *
 * 2. Chromatic values (node-type hues, risk/status, brand accents) stay hex, because
 *    they are alpha-concatenated (`${color}20`) — `var(--x)20` is not a colour — and
 *    because ReactFlow serialises some of them into SVG presentation attributes,
 *    where `var()` does not resolve.
 *
 * Where a chromatic accent is used as *text* it gets a separate `…Text` token that
 * is a var: #007dff and #2563EB cannot reach 4.5:1 on any dark background, not even
 * pure black, so the text role has to lighten while the fill role does not.
 */

export const colors = {
    // Brand colors
    brand: {
        primary: '#000063',
        accent: '#007dff',
        accentLight: '#b2d8f5',
        /** `accent` in a text or icon role. See the header note on contrast. */
        accentText: 'var(--calm-accent-text)',
    },

    // Background colors
    background: {
        base: 'var(--calm-bg-base)',
        secondary: 'var(--calm-bg-secondary)',
        tertiary: 'var(--calm-bg-tertiary)',
        card: 'var(--calm-bg-card)',
    },

    // Text colors
    text: {
        primary: 'var(--calm-text-primary)',
        secondary: 'var(--calm-text-secondary)',
        muted: 'var(--calm-text-muted)',
    },

    // Border colors
    border: {
        default: 'var(--calm-border-default)',
        dark: 'var(--calm-border-dark)',
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
        background: 'var(--calm-group-bg)',
        border: 'var(--calm-group-border)',
        label: 'var(--calm-group-label)',
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
        blueSoft: 'var(--calm-blue-soft)', // CURRENT pill bg, selected-row bg
        teal: '#1aa3b7', // architecture node border (thumbnails)
    },
    // A light ramp (50 lightest … 900 darkest) that inverts under dark, so that
    // `ink[900]` stays "the strongest text colour" in both themes.
    ink: {
        900: 'var(--calm-ink-900)',
        700: 'var(--calm-ink-700)',
        500: 'var(--calm-ink-500)',
        400: 'var(--calm-ink-400)',
        300: 'var(--calm-ink-300)',
        200: 'var(--calm-ink-200)',
        100: 'var(--calm-ink-100)',
        50: 'var(--calm-ink-50)',
    },
    timelineBg: 'var(--calm-timeline-bg)',
    new: '#ef4444',

    // ── CALM Hub redesign tokens (Phase 1) ────────────────────────────────────
    // Home for the navigation/browse redesign palette. Deliberately ADDITIVE and
    // namespaced under `redesign` so it does not touch the existing global brand
    // (`brand.primary` navy / `brand.accent`) or the logo — `#2563EB` here is the
    // redesign's interaction / selection colour only, per the design handoff.
    // Components in the new rail / namespace / domain surfaces consume these via
    // inline `style`. Tailwind pseudo-variants (e.g.
    // `focus-visible:outline-[var(--color-interaction)]`) can't read an inline
    // style, so `--color-interaction` is declared alongside the rest in theme.css.
    // Light values are exactly the spec's hex.
    redesign: {
        // Brand / interaction. `primary` stays hex: it is alpha-concatenated and fed
        // to ReactFlow SVG attributes. Use `primaryText` for a text or icon role.
        primary: '#2563EB', // active states, selection, links, focus, primary
        primaryText: 'var(--calm-interaction-text)', // `primary` as text / icon
        activeText: 'var(--calm-redesign-active-text)', // active tab / rail text
        tintBg: 'var(--calm-redesign-tint-bg)', // selected rail row, icon tile, active pill bg
        tint2: 'var(--calm-redesign-tint2)', // dropzone / welcome hover bg
        // Text scale
        ink: 'var(--calm-redesign-ink)', // H1/H2/H3, node labels
        bodyStrong: 'var(--calm-redesign-body-strong)', // current breadcrumb segment, strong body
        body: 'var(--calm-redesign-body)', // paragraph copy
        bodyAlt: 'var(--calm-redesign-body-alt)', // resting tab text
        muted: 'var(--calm-redesign-muted)', // sub-copy, card descriptions
        mutedAlt: 'var(--calm-redesign-muted-alt)', // meta
        faint: 'var(--calm-redesign-faint)', // mono section labels
        faintAlt: 'var(--calm-redesign-faint-alt)', // faint hints (NAMESPACES label colour)
        disabled: 'var(--calm-redesign-disabled)', // zero-count tab text + badge
        // Surfaces / borders
        borderStrong: 'var(--calm-redesign-border-strong)', // inputs, controls, minimap
        border: 'var(--calm-redesign-border)', // cards, rails, top bar, dividers
        tabDivider: 'var(--calm-redesign-tab-divider)', // tab bottom border
        canvas: 'var(--calm-redesign-canvas)', // diagram stage
        surface: 'var(--calm-redesign-surface)', // search bg, rail bg
        surfaceAlt: 'var(--calm-redesign-surface-alt)', // rail bg, minimap field
        // Resting count-badge bg / text
        badgeBg: 'var(--calm-redesign-badge-bg)',
        // Faint count-badge bg for a zero-count (dimmed) tab
        badgeBgFaint: 'var(--calm-redesign-badge-bg-faint)',
        // Selected-rail accent (inset left bar)
        railAccentShadow: 'inset 3px 0 0 #2563EB',
    },

    // Resource-type accents (badges, card thumbnails, node borders, type dots).
    // `accent` is the chromatic fill/border/stripe value and stays hex (it is
    // alpha-concatenated in ItemCard). `accentText` is the same colour in a text or
    // icon role, which has to lighten under dark to clear 4.5:1 against `tint`.
    resourceTypes: {
        architecture: {
            accent: '#2563EB',
            accentText: 'var(--calm-rt-architecture-text)',
            tint: 'var(--calm-rt-architecture-tint)',
        },
        pattern: {
            accent: '#7C3AED',
            accentText: 'var(--calm-rt-pattern-text)',
            tint: 'var(--calm-rt-pattern-tint)',
        },
        flow: {
            accent: '#0891B2',
            accentText: 'var(--calm-rt-flow-text)',
            tint: 'var(--calm-rt-flow-tint)',
        },
        standard: {
            accent: '#D97706',
            accentText: 'var(--calm-rt-standard-text)',
            tint: 'var(--calm-rt-standard-tint)',
        },
        adr: {
            accent: '#DB2777',
            accentText: 'var(--calm-rt-adr-text)',
            tint: 'var(--calm-rt-adr-tint)',
        },
        interface: {
            accent: '#059669',
            accentText: 'var(--calm-rt-interface-text)',
            tint: 'var(--calm-rt-interface-tint)',
        },
        // Controls aren't a namespace browse type, but their browse card reuses the
        // shared ItemCard/TypeBadge. Uses the interaction/selection blue (matching
        // redesign.primary / tintBg) so control cards read as the selectable family.
        control: {
            accent: '#2563EB',
            accentText: 'var(--calm-rt-control-text)',
            tint: 'var(--calm-rt-control-tint)',
        },
    },
    diffPalette: {
        add: {
            bg: 'var(--calm-diff-add-bg)',
            border: 'var(--calm-diff-add-border)',
            fg: 'var(--calm-diff-add-fg)',
            sign: '+',
        },
        mod: {
            bg: 'var(--calm-diff-mod-bg)',
            border: 'var(--calm-diff-mod-border)',
            fg: 'var(--calm-diff-mod-fg)',
            sign: '~',
        },
        del: {
            bg: 'var(--calm-diff-del-bg)',
            border: 'var(--calm-diff-del-border)',
            fg: 'var(--calm-diff-del-fg)',
            sign: '−',
        },
    },
} as const;

export type Colors = typeof colors;
