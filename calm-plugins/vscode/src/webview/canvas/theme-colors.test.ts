import { describe, expect, it } from 'vitest';
import {
    THEME_BG_FALLBACK,
    cssColorToHex,
    onSurface,
    theme,
    tint,
} from './theme-colors';

describe('theme tokens', () => {
    it('points every canvas colour at a VS Code theme variable', () => {
        for (const value of Object.values(theme)) {
            expect(value).toContain('--vscode-');
        }
    });

    it('mixes theme colours instead of a fixed rgb', () => {
        expect(tint(theme.blue, 12)).toBe(
            `color-mix(in srgb, ${theme.blue} 12%, transparent)`,
        );
        expect(onSurface(theme.green, 22)).toContain('--vscode-charts-green');
        expect(onSurface(theme.green, 22)).toContain('--vscode-editor-background');
    });
});

describe('cssColorToHex', () => {
    it('normalises hex colours for the colour input', () => {
        expect(cssColorToHex('#1e293b', THEME_BG_FALLBACK)).toBe('#1e293b');
        expect(cssColorToHex('  #F8FAFC  ', THEME_BG_FALLBACK)).toBe('#f8fafc');
        expect(cssColorToHex('#AABBCCDD', THEME_BG_FALLBACK)).toBe('#aabbcc');
        expect(cssColorToHex('#abc', THEME_BG_FALLBACK)).toBe('#aabbcc');
        expect(cssColorToHex('#abcd', THEME_BG_FALLBACK)).toBe('#aabbcc');
    });

    it('converts rgb() and rgba() colours', () => {
        expect(cssColorToHex('rgb(30, 41, 59)', THEME_BG_FALLBACK)).toBe('#1e293b');
        expect(cssColorToHex('rgba(255, 128, 0, 0.2)', THEME_BG_FALLBACK)).toBe('#ff8000');
        expect(cssColorToHex('rgb(30 41 59 / 0.5)', THEME_BG_FALLBACK)).toBe('#1e293b');
        expect(cssColorToHex('rgb(30.2, 41.6, 59.4)', THEME_BG_FALLBACK)).toBe('#1e2a3b');
    });

    it('returns the fallback when the value is not a usable colour', () => {
        expect(cssColorToHex('', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('   ', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('red', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('var(--vscode-foreground)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('#gggggg', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('#12', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('#12345', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('rgb(999, 0, 0)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('rgb(-1, 0, 0)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
    });
});
