import { describe, expect, it } from 'vitest';
import { brandStyleSheet, brandTheme, FOCUS_SURFACES, MIN_FOCUS_CONTRAST, MIN_TEXT_CONTRAST, THEME_SURFACES } from './brand-colours.js';
import { contrastRatio } from '../navbar/text-colour.js';

const WHITE = '#ffffff';

describe('brandTheme', () => {
    it('keeps CALM tokens when no colour is configured', () => {
        expect(brandTheme(undefined)).toBeUndefined();
        expect(brandTheme({ organisationName: 'Northstar' })).toBeUndefined();
        expect(brandTheme({ colour: 'teal' })).toBeUndefined();
    });

    it('keeps a brand colour that is already readable on the light theme', () => {
        expect(brandTheme({ colour: '#0F766E' })?.light?.['--color-primary']).toBe('#0f766e');
    });

    it('uses the dark colour as given when it is readable', () => {
        expect(brandTheme({ colour: '#0f766e', colourDark: '#75d6c7' })?.dark?.['--color-primary']).toBe('#75d6c7');
    });

    // A pale yellow, a navy that vanishes on dark, a mid grey, and the extremes.
    it.each(['#ffd400', '#000063', '#808080', '#ffffff', '#000000', '#2563eb'])(
        'makes %s readable in both themes',
        (colour) => {
            const theme = brandTheme({ colour })!;
            for (const name of ['light', 'dark'] as const) {
                const tokens = theme[name]!;
                const backgrounds = [...THEME_SURFACES[name], tokens['--calm-redesign-tint-bg']];
                for (const background of backgrounds) {
                    expect(contrastRatio(tokens['--color-primary'], background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
                }
                expect(contrastRatio(tokens['--color-primary'], tokens['--color-primary-content'])).toBeGreaterThanOrEqual(
                    MIN_TEXT_CONTRAST
                );
                expect(contrastRatio(tokens['--color-interaction'], WHITE)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
                for (const surface of FOCUS_SURFACES[name]) {
                    expect(contrastRatio(tokens['--color-interaction'], surface)).toBeGreaterThanOrEqual(MIN_FOCUS_CONTRAST);
                }
            }
        }
    );

    it('styles only the theme that has a colour', () => {
        const css = brandStyleSheet(brandTheme({ colourDark: '#75d6c7' })!);

        expect(css).toContain("html:root[data-theme='dark']");
        expect(css).not.toContain("data-theme='light'");
    });
});
