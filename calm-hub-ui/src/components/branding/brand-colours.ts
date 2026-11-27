import { UiBranding } from '../../model/ui-config.js';
import { contrastRatio, relativeLuminance, textColourFor } from '../navbar/text-colour.js';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const WHITE = '#ffffff';
/** The surfaces of each theme that text in the brand colour sits on: `--color-base-100` to `-300`. */
export const THEME_SURFACES = {
    light: ['#ffffff', '#eeeeee'],
    dark: ['#0f172a', '#1e293b', '#334155'],
} as const;
/**
 * Where focus rings and filled controls sit: base-100 and base-200. No colour reaches 3:1 on dark base-300 and still
 * carries white text at 4.5:1, and CALM's own interaction blue does not either.
 */
export const FOCUS_SURFACES = {
    light: THEME_SURFACES.light,
    dark: THEME_SURFACES.dark.slice(0, 2),
} as const;
const TINT_WEIGHT = { light: 0.1, dark: 0.22 } as const;
export const MIN_TEXT_CONTRAST = 4.5;
/** WCAG 1.4.11: a focus ring needs 3:1 against the page. */
export const MIN_FOCUS_CONTRAST = 3;

export type BrandTokens = Record<string, string>;
export interface BrandTheme {
    light?: BrandTokens;
    dark?: BrandTokens;
}

type ThemeName = keyof typeof THEME_SURFACES;

function channels(hex: string): number[] {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** `weight` of `colour` and the rest of `other`, mixed per sRGB channel. */
export function mix(colour: string, other: string, weight: number): string {
    const a = channels(colour);
    const b = channels(other);
    return `#${a.map((value, i) => Math.round(value * weight + b[i] * (1 - weight)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The colour, darkened on light backgrounds or lightened on dark ones only as far as it needs to reach `ratio`
 * against each of them. All the backgrounds must be light, or all dark.
 */
export function readableOn(colour: string, backgrounds: readonly string[], ratio = MIN_TEXT_CONTRAST): string {
    const towards = relativeLuminance(backgrounds[0]) > 0.18 ? '#000000' : WHITE;
    const reads = (candidate: string) => backgrounds.every((background) => contrastRatio(candidate, background) >= ratio);
    for (let step = 0; step < 200; step++) {
        const candidate = mix(towards, colour, step / 200);
        if (reads(candidate)) return candidate;
    }
    return towards;
}

function tokens(colour: string, theme: ThemeName): BrandTokens {
    const surfaces = THEME_SURFACES[theme];
    const tint = mix(colour, surfaces[0], TINT_WEIGHT[theme]);
    const text = readableOn(colour, [...surfaces, tint]);
    // Filled controls carry white text in both themes, as CALM's interaction blue does.
    const fill = readableOn(colour, [WHITE]);
    const interaction = readableOn(fill, FOCUS_SURFACES[theme], MIN_FOCUS_CONTRAST);
    return {
        '--color-primary': text,
        '--color-primary-content': textColourFor(text),
        '--color-interaction': interaction,
        '--calm-interaction-text': text,
        '--calm-redesign-active-text': text,
        '--calm-redesign-tint-bg': tint,
        '--calm-rail-accent': interaction,
    };
}

function hex(value?: string): string | undefined {
    return value && HEX_COLOUR.test(value) ? value.toLowerCase() : undefined;
}

/**
 * The theme tokens that the brand colour replaces. Without `colourDark`, the dark theme uses `colour` too, made light
 * enough to read. Without a colour, CALM's tokens stay.
 */
export function brandTheme(branding?: UiBranding): BrandTheme | undefined {
    const light = hex(branding?.colour);
    const dark = hex(branding?.colourDark) ?? light;
    if (!light && !dark) return undefined;
    return {
        light: light ? tokens(light, 'light') : undefined,
        dark: dark ? tokens(dark, 'dark') : undefined,
    };
}

/** `html:root[data-theme=…]` is more specific than the `:root[data-theme=…]` blocks of theme.css. */
export function brandStyleSheet(theme: BrandTheme): string {
    return (['light', 'dark'] as const)
        .filter((name) => theme[name])
        .map((name) => {
            const declarations = Object.entries(theme[name]!)
                .map(([property, value]) => `${property}: ${value};`)
                .join(' ');
            return `html:root[data-theme='${name}'] { ${declarations} }`;
        })
        .join('\n');
}
