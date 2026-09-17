// @vitest-environment node
//
// Runs under node, not jsdom, for the same reason as the sibling
// `monaco-theme.test.ts`: this suite reads `theme.css` off disk through
// `import.meta.url`, and under jsdom that is not a `file:` URL, so
// `fileURLToPath` throws before a single pair is checked. Nothing here touches
// the DOM.
/**
 * Colour-contrast guard for the redesign text tokens.
 *
 * The redesign palette is consumed as CSS custom properties, so a contrast
 * failure is a property of a token pair rather than of any one component. That
 * makes it checkable without a browser: read the two theme blocks out of
 * `theme.css`, resolve each pair, and compute the WCAG ratio.
 *
 * Every pair below is one that actually occurs in the UI, added as the
 * component using it is found. The list is written by hand rather than derived,
 * so it grows with the UI instead of being exhaustive by construction.
 *
 * The threshold is 4.5:1 (WCAG 2.2 SC 1.4.3, AA) because all of this text is
 * small: the rail section labels are 10px and the count badges 11px, nowhere
 * near the 18.66px bold / 24px large-text exemption.
 *
 * The point is the pairing. A token that reads comfortably on the page
 * background can still fail on a badge, which is exactly how two of these were
 * missed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Reads `theme.css` off disk.
 *
 * Not `import './theme.css?raw'`: Vitest stubs the CSS transform by default, so
 * a raw import resolves to an empty string and every assertion below would pass
 * against nothing. Resolved via `import.meta.url` rather than `process.cwd()`,
 * same as the sibling `monaco-theme.test.ts`, so it works regardless of which
 * directory the suite is invoked from.
 */
function readThemeCss(): string {
    return readFileSync(fileURLToPath(new URL('./theme.css', import.meta.url)), 'utf8');
}

const THEME_CSS = readThemeCss();

/** WCAG 2.2 SC 1.4.3 minimum for text below the large-text threshold. */
const AA_NORMAL_TEXT = 4.5;

/**
 * The dark block's selector. Matched by pattern rather than as a literal so that
 * a change of attribute quoting in `theme.css` cannot silently split the file in
 * the wrong place and leave every pair below checked against one theme twice.
 */
const DARK_SELECTOR = /:root\[data-theme=['"]?dark['"]?\]/;

/** Token pairs that occur in the UI, as `[text, surface]`. */
const PAIRS: readonly [string, string][] = [
    // Rail section labels: `NAMESPACES`, `CONTROL DOMAINS`.
    ['calm-redesign-faint-alt', 'calm-redesign-surface-alt'],
    ['calm-redesign-faint-alt', 'calm-redesign-surface'],
    ['calm-redesign-faint-alt', 'calm-bg-base'],
    // Count badges on the namespace links and the segmented type tabs.
    ['calm-redesign-muted-alt', 'calm-redesign-badge-bg'],
    ['calm-redesign-muted-alt', 'calm-redesign-badge-bg-faint'],
    ['calm-redesign-muted-alt', 'calm-bg-base'],
    // The dropzone's format hint, on the resting dropzone panel.
    ['calm-redesign-muted-alt', 'calm-redesign-surface'],
    // Body copy and headings on the page and the diagram stage.
    ['calm-redesign-muted', 'calm-bg-base'],
    ['calm-redesign-body', 'calm-bg-base'],
    ['calm-redesign-body', 'calm-redesign-surface'],
    ['calm-redesign-body-alt', 'calm-bg-base'],
    ['calm-redesign-ink', 'calm-bg-base'],
    ['calm-redesign-ink', 'calm-redesign-canvas'],
];

/**
 * Pulls the six-digit hex custom properties out of one theme block.
 *
 * The light block is everything before the dark selector, which keeps this
 * honest about cascade order: a token redeclared later in the same block wins,
 * and so does the last match here.
 */
function tokensFor(theme: 'light' | 'dark'): Record<string, string> {
    const darkMatch = DARK_SELECTOR.exec(THEME_CSS);
    if (!darkMatch) {
        throw new Error(`theme.css no longer contains a ${DARK_SELECTOR} block`);
    }
    const darkStart = darkMatch.index;

    const block = theme === 'dark' ? THEME_CSS.slice(darkStart) : THEME_CSS.slice(0, darkStart);
    const tokens: Record<string, string> = {};
    for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
        tokens[match[1]] = match[2];
    }
    return tokens;
}

/** Relative luminance, per WCAG 2.x. */
function luminance(hex: string): number {
    const channels = [1, 3, 5].map((offset) => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
    const tokens = tokensFor(theme);

    it.each(PAIRS)('%s on %s meets WCAG AA for normal text', (text, surface) => {
        const foreground = tokens[text];
        const background = tokens[surface];

        // A renamed or deleted token would otherwise make this pass vacuously.
        expect(foreground, `--${text} is not defined in the ${theme} theme`).toBeDefined();
        expect(background, `--${surface} is not defined in the ${theme} theme`).toBeDefined();

        const ratio = contrastRatio(foreground, background);
        expect(ratio, `--${text} (${foreground}) on --${surface} (${background}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
            AA_NORMAL_TEXT
        );
    });
});
