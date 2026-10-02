import { describe, it, expect } from 'vitest';
import { getBadgeStyle } from './edgeBadge.utils.js';
import { THEME } from '../theme.js';

describe('edgeBadge.utils', () => {
    describe('getBadgeStyle', () => {
        it('returns accent colors when hasFlowInfo is true', () => {
            const result = getBadgeStyle(true);
            expect(result).toEqual({
                background: `${THEME.colors.accent}20`,
                border: THEME.colors.accent,
                iconColor: THEME.colors.accent,
            });
        });

        it('returns success colors when hasAIGF is true', () => {
            const result = getBadgeStyle(false);
            expect(result).toEqual({
                background: `${THEME.colors.success}20`,
                border: THEME.colors.success,
                iconColor: THEME.colors.success,
            });
        });

        it('has the correct alpha value for background colors', () => {
            const result = getBadgeStyle(true);
            expect(result.background).toMatch(/^#[0-9a-f]+20$/i);
        });
    });
});
