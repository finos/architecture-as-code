/**
 * Colours for the canvas webview. Each one is a `--calm-*` token from canvas.css, which maps it to
 * the active VS Code theme, so inline styles and the stylesheet stay in step.
 */

/** Dark-theme defaults for the appearance picker, which needs a hex value. */
export const THEME_BG_FALLBACK = '#252526';
export const THEME_TEXT_FALLBACK = '#cccccc';

export const theme = {
    fg: 'var(--calm-fg)',
    fgMuted: 'var(--calm-fg-muted)',
    /** Text on the canvas. Some themes set a much lighter `foreground` for the UI. */
    text: 'var(--calm-text)',
    bg: 'var(--calm-bg)',
    bgWidget: 'var(--calm-bg-widget)',
    border: 'var(--calm-border)',
    borderWidget: 'var(--calm-border-heavy)',
    borderInput: 'var(--calm-border-input)',
    focus: 'var(--calm-focus)',
    link: 'var(--calm-link)',
    badgeBg: 'var(--calm-badge-bg)',
    badgeFg: 'var(--calm-badge-fg)',
    shadow: 'var(--calm-shadow)',
    errorFg: 'var(--calm-error-fg)',
    errorBg: 'var(--calm-error-bg)',
    warningFg: 'var(--calm-warning-fg)',
    warningBg: 'var(--calm-warning-bg)',
    green: 'var(--calm-green)',
    blue: 'var(--calm-blue)',
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

    // Chromium reports a computed color-mix() in this form, with channels from 0 to 1.
    const srgb = /^color\(\s*srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i.exec(value);
    if (srgb) {
        const channels = [srgb[1], srgb[2], srgb[3]].map(Number);
        if (channels.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return fallback;
        return `#${channels.map((n) => Math.round(n * 255).toString(16).padStart(2, '0')).join('')}`;
    }

    const rgb = /^rgba?\(\s*([0-9.]+%?)[,\s]+([0-9.]+%?)[,\s]+([0-9.]+%?)/i.exec(value);
    if (!rgb) return fallback;

    const channels: string[] = [];
    for (const part of [rgb[1], rgb[2], rgb[3]]) {
        const percent = part.endsWith('%');
        const n = Number(percent ? part.slice(0, -1) : part);
        if (!Number.isFinite(n) || n < 0 || n > (percent ? 100 : 255)) return fallback;
        channels.push(Math.round(percent ? (n * 255) / 100 : n).toString(16).padStart(2, '0'));
    }
    return `#${channels.join('')}`;
}

/** A standard-node outline. The fill is `badgeBg`, so mix in the foreground to set it apart. */
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
