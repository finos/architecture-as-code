import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
    THEME_BG_FALLBACK,
    blockBorder,
    cssColorToHex,
    readableTextOn,
    onSurface,
    theme,
    tint,
} from './theme-colors';

describe('theme tokens', () => {
    it('points every canvas colour at a canvas.css token that maps a VS Code theme variable', () => {
        const css = readFileSync(path.join(__dirname, '..', 'canvas.css'), 'utf8');
        for (const value of Object.values(theme)) {
            const token = /^var\((--calm-[a-z-]+)\)$/.exec(value)?.[1];
            expect(token, value).toBeDefined();
            expect(css, `${token} in canvas.css`).toMatch(new RegExp(`${token}: var\\(--vscode-[A-Za-z.-]+, [^;]+\\);`));
        }
    });

    it('mixes theme colours instead of a fixed rgb', () => {
        expect(tint(theme.blue, 12)).toBe(
            `color-mix(in srgb, ${theme.blue} 12%, transparent)`,
        );
        expect(onSurface(theme.green, 22)).toBe(
            'color-mix(in srgb, var(--calm-green) 22%, var(--calm-bg))',
        );
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
        expect(cssColorToHex('rgb(100%, 50%, 0%)', THEME_BG_FALLBACK)).toBe('#ff8000');
        expect(cssColorToHex('rgb(100% 50% 0% / 0.5)', THEME_BG_FALLBACK)).toBe('#ff8000');
        expect(cssColorToHex('color(srgb 0.117647 0.160784 0.231373)', THEME_BG_FALLBACK)).toBe('#1e293b');
        expect(cssColorToHex('color(srgb 1 0.5 0 / 0.4)', THEME_BG_FALLBACK)).toBe('#ff8000');
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
        expect(cssColorToHex('color(srgb 1.5 0 0)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('rgb(101%, 0%, 0%)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
        expect(cssColorToHex('color(display-p3 1 0 0)', THEME_BG_FALLBACK)).toBe(THEME_BG_FALLBACK);
    });
});

describe('blockBorder', () => {
    it('mixes the badge colour with the foreground, so it differs from the fill', () => {
        expect(blockBorder).toBe('color-mix(in srgb, var(--calm-badge-bg) 60%, var(--calm-fg))');
    });
});

describe('readableTextOn', () => {
    it('gives dark text on a pale background', () => {
        expect(readableTextOn('#f8fafc')).toBe('#1e293b');
        expect(readableTextOn('rgb(255, 240, 200)')).toBe('#1e293b');
    });

    it('gives light text on a dark background', () => {
        expect(readableTextOn('#1e1e1e')).toBe('#ffffff');
        expect(readableTextOn('#0e639c')).toBe('#ffffff');
    });

    it('returns undefined when there is no background or it cannot be read', () => {
        expect(readableTextOn(undefined)).toBeUndefined();
        expect(readableTextOn('')).toBeUndefined();
        expect(readableTextOn('var(--vscode-foreground)')).toBeUndefined();
    });
});
