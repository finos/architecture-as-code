// @vitest-environment node
//
// Runs under node, not jsdom: this suite reads theme.css off disk, and needs
// `import.meta.url` to be a real file URL. Importing the stylesheet with `?raw`
// is not an option — the Tailwind plugin claims .css and hands back an empty
// string. Nothing here touches the DOM.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CALM_DARK, defineCalmThemes, SOURCES } from './monaco-theme.js';

/** The `--calm-*` / `--color-*` values from the dark block of theme.css. */
function darkTokens(): Record<string, string> {
    const css = readFileSync(fileURLToPath(new URL('./theme.css', import.meta.url)), 'utf8');
    const dark = css.split(":root[data-theme='dark']")[1];
    expect(dark, "theme.css should contain a :root[data-theme='dark'] block").toBeDefined();
    return Object.fromEntries(
        [...dark.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
    );
}

function capturedTheme() {
    const defineTheme = vi.fn();
    defineCalmThemes({ editor: { defineTheme } } as unknown as Parameters<
        typeof defineCalmThemes
    >[0]);
    expect(defineTheme).toHaveBeenCalledOnce();
    const [name, data] = defineTheme.mock.calls[0];
    return { name, data } as {
        name: string;
        data: { base: string; inherit: boolean; rules: unknown[]; colors: Record<string, string> };
    };
}

describe('defineCalmThemes', () => {
    it('registers the dark theme under the name the editor asks for', () => {
        const { name, data } = capturedTheme();
        expect(name).toBe(CALM_DARK);
        expect(data.base).toBe('vs-dark');
        // Chrome only: vs-dark's JSON syntax colours are kept.
        expect(data.inherit).toBe(true);
        expect(data.rules).toEqual([]);
    });

    it('paints the editor on bg-base-200, the surface every call site wraps it in', () => {
        const { data } = capturedTheme();
        expect(data.colors['editor.background']).toBe(darkTokens()['--calm-bg-secondary']);
        // vs-dark's own background, which is what looked foreign against the slate UI.
        expect(data.colors['editor.background']).not.toBe('#1E1E1E');
    });

    // Monaco cannot read CSS custom properties, so the hex is duplicated. This is the
    // guard that keeps the copy honest.
    it('every colour matches its theme.css dark token', () => {
        const tokens = darkTokens();
        const { data } = capturedTheme();

        for (const [key, source] of Object.entries(SOURCES)) {
            const expected = tokens[source];
            expect(expected, `theme.css is missing ${source}`).toBeDefined();

            const actual = data.colors[key];
            expect(actual, `monaco theme is missing ${key}`).toBeDefined();

            // Alpha-carrying colours keep the token's RGB and append two hex digits.
            expect(actual.slice(0, 7).toLowerCase(), `${key} should track ${source}`).toBe(
                expected.toLowerCase()
            );
            expect(actual.length === 7 || actual.length === 9).toBe(true);
        }
    });

    it('declares a source for every colour it sets', () => {
        const { data } = capturedTheme();
        expect(Object.keys(data.colors).sort()).toEqual(Object.keys(SOURCES).sort());
    });
});
