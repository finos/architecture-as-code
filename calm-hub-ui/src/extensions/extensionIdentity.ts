/** The extensions that CALM Hub ships on its classpath (`META-INF/calm-extensions/builtin/index.txt`). */
export const BUILTIN_EXTENSION_IDS: ReadonlySet<string> = new Set(['control-evaluation', 'deployment']);

export const isBuiltInExtension = (id: string) => BUILTIN_EXTENSION_IDS.has(id);

/**
 * Marker colours for extensions. Each has at least 3:1 contrast against the light card (#ffffff) and the dark card
 * (#1E293B), so a marker reads in both themes. The marker is never the only cue: a label always names the extension.
 */
export const EXTENSION_MARKER_PALETTE: readonly string[] = [
    '#2F7FD8', // blue
    '#C0590A', // orange
    '#1D8F6A', // green
    '#B5469C', // magenta
    '#7A63D6', // violet
    '#A57A00', // ochre
    '#D0435A', // rose
    '#0E8FA3', // teal
];

/** The neutral marker of a built-in view. */
export const BUILTIN_MARKER = '#7C8797';

/** FNV-1a, so an extension keeps its colour across sessions and installs. */
function hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function extensionMarkerColour(id: string): string {
    if (isBuiltInExtension(id)) return BUILTIN_MARKER;
    return EXTENSION_MARKER_PALETTE[hash(id) % EXTENSION_MARKER_PALETTE.length];
}
