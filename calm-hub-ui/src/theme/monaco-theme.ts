import type { Monaco } from '@monaco-editor/react';

/** Name the editor is given via its `theme` prop once `defineCalmThemes` has run. */
export const CALM_DARK = 'calm-dark';

/**
 * Monaco's theme API takes literal hex — it cannot read the `--calm-*` custom
 * properties, and it paints its own chrome rather than deferring to our stylesheet.
 * So the dark values are duplicated here, and `monaco-theme.test.ts` fails if they
 * ever drift from the `:root[data-theme='dark']` block in theme.css.
 *
 * `SOURCES` records which token each colour came from. Colours carrying an alpha
 * suffix keep the token's RGB and add two hex digits; the test compares the first
 * seven characters.
 */
export const SOURCES: Record<string, string> = {
    'editor.background': '--calm-bg-secondary',
    'editorGutter.background': '--calm-bg-secondary',
    'editor.foreground': '--calm-text-primary',
    'editorLineNumber.foreground': '--calm-text-muted',
    'editorLineNumber.activeForeground': '--calm-text-secondary',
    'editorCursor.foreground': '--calm-interaction-text',
    'editorIndentGuide.background1': '--calm-border-default',
    'editorIndentGuide.activeBackground1': '--calm-border-dark',
    'editorWidget.background': '--calm-bg-base',
    'editorWidget.border': '--calm-border-default',
    'editor.selectionBackground': '--color-interaction',
    'editor.inactiveSelectionBackground': '--color-interaction',
    'editor.lineHighlightBackground': '--calm-bg-base',
    'editorBracketMatch.background': '--color-interaction',
    'editorBracketMatch.border': '--calm-interaction-text',
    'scrollbarSlider.background': '--calm-border-dark',
    'scrollbarSlider.hoverBackground': '--calm-border-dark',
    'scrollbarSlider.activeBackground': '--calm-border-dark',
};

const COLORS: Record<string, string> = {
    // The editor sits inside a `bg-base-200` wrapper at every call site, so it takes
    // that surface rather than vs-dark's #1E1E1E, which reads as a foreign panel.
    'editor.background': '#1E293B',
    'editorGutter.background': '#1E293B',
    'editor.foreground': '#E2E8F0',
    'editorLineNumber.foreground': '#64748B',
    'editorLineNumber.activeForeground': '#94A3B8',
    'editorCursor.foreground': '#93B4FF',
    'editorIndentGuide.background1': '#334155',
    'editorIndentGuide.activeBackground1': '#475569',
    'editorWidget.background': '#0F172A',
    'editorWidget.border': '#334155',
    'editor.selectionBackground': '#2563EB59',
    'editor.inactiveSelectionBackground': '#2563EB26',
    'editor.lineHighlightBackground': '#0F172A66',
    'editorBracketMatch.background': '#2563EB33',
    'editorBracketMatch.border': '#93B4FF',
    'scrollbarSlider.background': '#47556966',
    'scrollbarSlider.hoverBackground': '#47556999',
    'scrollbarSlider.activeBackground': '#475569CC',
};

/**
 * Registers the CALM dark editor theme.
 *
 * Chrome only — `inherit: true` keeps vs-dark's JSON syntax colours, which already
 * read well on the slate surface. Called unconditionally from `beforeMount`, and not
 * only when the dark theme is active: an editor first mounted in light must still be
 * able to switch to `calm-dark` when the user toggles.
 *
 * Light mode deliberately keeps Monaco's built-in `light` theme. Its white surface
 * already matches `bg-base-100`, and defining a theme for it would risk moving
 * pixels that are currently correct.
 */
export function defineCalmThemes(monaco: Monaco): void {
    monaco.editor.defineTheme(CALM_DARK, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: COLORS,
    });
}
