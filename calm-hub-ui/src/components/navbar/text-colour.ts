export function relativeLuminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
    const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
}

/** Black or white text, whichever has the higher WCAG contrast against the background. */
export function textColourFor(hex: string): string {
    return relativeLuminance(hex) > 0.179 ? '#000000' : '#ffffff';
}
