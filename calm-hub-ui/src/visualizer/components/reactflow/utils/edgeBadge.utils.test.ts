import { describe, it, expect } from 'vitest';
import { getBadgeStyle } from './edgeBadge.utils.js';
import { THEME } from '../theme.js';

describe('edgeBadge.utils', () => {
    describe('getBadgeStyle', () => {
        it('returns accent colors when hasFlowInfo is true', () => {
            const result = getBadgeStyle(true, false);
            expect(result).toEqual({
                background: `${THEME.colors.accent}20`,
                border: THEME.colors.accent,
                iconColor: THEME.colors.accent,
            });
        });

        it('returns success colors when hasAIGF is true', () => {
            const result = getBadgeStyle(false, true);
            expect(result).toEqual({
                background: `${THEME.colors.success}20`,
                border: THEME.colors.success,
                iconColor: THEME.colors.success,
            });
        });

        it('returns muted colors when both flags are false', () => {
            const result = getBadgeStyle(false, false);
            // `muted` is a theme var, so its tint is mixed rather than suffixed with
            // the `20` alpha byte the chromatic branches use.
            expect(result).toEqual({
                background: `color-mix(in srgb, ${THEME.colors.muted} 12.5%, transparent)`,
                border: THEME.colors.muted,
                iconColor: THEME.colors.muted,
            });
        });

        it('prioritizes hasFlowInfo over hasAIGF when both are true', () => {
            const result = getBadgeStyle(true, true);
            expect(result).toEqual({
                background: `${THEME.colors.accent}20`,
                border: THEME.colors.accent,
                iconColor: THEME.colors.accent,
            });
        });

        it('has the correct alpha value for background colors', () => {
            const result = getBadgeStyle(true, false);
            expect(result.background).toMatch(/^#[0-9a-f]+20$/i);
        });
    });
});
