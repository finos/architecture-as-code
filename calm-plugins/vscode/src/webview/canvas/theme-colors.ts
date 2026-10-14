/**
 * Colours for the canvas webview, taken from the active VS Code theme.
 * Fallbacks match the dark-theme defaults in canvas.css.
 */

export const THEME_BG_VAR = '--vscode-editorWidget-background';
export const THEME_TEXT_VAR = '--vscode-foreground';
export const THEME_BG_FALLBACK = '#252526';
export const THEME_TEXT_FALLBACK = '#cccccc';

export const theme = {
    fg: `var(${THEME_TEXT_VAR}, ${THEME_TEXT_FALLBACK})`,
    fgMuted: 'var(--vscode-descriptionForeground, #888888)',
    /** Text on the canvas. Some themes set a much lighter `foreground` for the UI. */
    text: 'var(--vscode-editor-foreground, #d4d4d4)',
    bg: 'var(--vscode-editor-background, #1e1e1e)',
    bgWidget: `var(${THEME_BG_VAR}, ${THEME_BG_FALLBACK})`,
    border: 'var(--vscode-panel-border, #2d2d2d)',
    borderWidget: 'var(--vscode-widget-border, #444444)',
    borderInput: 'var(--vscode-input-border, #555555)',
    focus: 'var(--vscode-focusBorder, #007fd4)',
    link: 'var(--vscode-textLink-foreground, #3794ff)',
    badgeBg: 'var(--vscode-badge-background, #0e639c)',
    badgeFg: 'var(--vscode-badge-foreground, #ffffff)',
    shadow: 'var(--vscode-widget-shadow, rgba(0, 0, 0, 0.36))',
    errorFg: 'var(--vscode-editorError-foreground, #f14c4c)',
    errorBg: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    warningFg: 'var(--vscode-editorWarning-foreground, #cca700)',
    warningBg: 'var(--vscode-inputValidation-warningBackground, #352a05)',
    green: 'var(--vscode-charts-green, #89d185)',
    blue: 'var(--vscode-charts-blue, #3794ff)',
} as const;

/** A translucent wash of a theme colour. Containers stay see-through. */
export function tint(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** An opaque mix of a theme colour onto the editor background. */
export function onSurface(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, ${theme.bg})`;
}

/**
 * `<input type="color">` only accepts `#rrggbb`. Theme variables arrive as
 * hex or rgb(), so the appearance picker resolves them before display.
 */
export function cssColorToHex(raw: string, fallback: string): string {
    const value = raw.trim();
    if (!value) return fallback;

    const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
    if (hex) {
        const digits = hex[1];
        if (digits.length === 3 || digits.length === 4) {
            const [r, g, b] = digits;
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }
        if (digits.length === 6 || digits.length === 8) {
            return `#${digits.slice(0, 6).toLowerCase()}`;
        }
        return fallback;
    }

    const rgb = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i.exec(value);
    if (!rgb) return fallback;

    const channels: string[] = [];
    for (const part of [rgb[1], rgb[2], rgb[3]]) {
        const n = Number(part);
        if (!Number.isFinite(n) || n < 0 || n > 255) return fallback;
        channels.push(Math.round(n).toString(16).padStart(2, '0'));
    }
    return `#${channels.join('')}`;
}

/** A building-block outline. The fill is `badgeBg`, so mix in the foreground to set it apart. */
export const blockBorder = `color-mix(in srgb, ${theme.badgeBg} 60%, ${theme.fg})`;

const DARK_TEXT = '#1e293b';
const LIGHT_TEXT = '#ffffff';

function relativeLuminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Dark or light text for a background the user chose, whichever has more contrast. The theme
 * text colour is not safe there: a pale override in a dark theme gets pale text. Undefined when
 * the colour cannot be read, so the caller keeps its theme default.
 */
export function readableTextOn(background: string | undefined): string | undefined {
    if (!background) return undefined;
    const hex = cssColorToHex(background, '');
    if (!hex) return undefined;
    const bg = relativeLuminance(hex);
    const onDark = (relativeLuminance(LIGHT_TEXT) + 0.05) / (bg + 0.05);
    const onLight = (bg + 0.05) / (relativeLuminance(DARK_TEXT) + 0.05);
    return onLight >= onDark ? DARK_TEXT : LIGHT_TEXT;
}
