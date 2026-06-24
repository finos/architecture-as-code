/**
 * CALM Hub redesign — non-colour design tokens (Phase 1).
 *
 * Radius, shadow and motion values from the design handoff, kept here so the new
 * rail / namespace / domain components pull spacing + elevation from one source
 * rather than scattering magic numbers. Colours live in `colors.ts` under the
 * `redesign` / `resourceTypes` groups; this file is the additive companion for
 * everything that isn't a colour. Nothing here touches the global theme.
 */
export const redesignTokens = {
    radius: {
        pill: '7px', // inputs / pills (7–8px)
        input: '7px',
        card: '12px',
        iconTile: '10px', // icon tiles (10–11px)
    },
    shadow: {
        card: '0 1px 2px rgba(16,24,40,.04)',
        floating: '0 2px 6px rgba(16,24,40,.06)',
        railAccent: 'inset 3px 0 0 #2563EB', // selected rail row left accent
    },
    transition: '120ms ease', // hover/active transitions ~120–160ms ease
    rail: {
        width: '236px',
        padding: '18px 12px',
    },
} as const;

export type RedesignTokens = typeof redesignTokens;
