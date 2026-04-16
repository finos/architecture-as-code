/**
 * Pattern to detect calm-hub internal ADR links.
 * Matches paths like /calm/namespaces/{ns}/adrs/{id}
 */
const CALM_HUB_ADR_PATTERN = /^\/calm\/namespaces\/([^/]+)\/adrs\/(\d+)/;

/**
 * Extract a display name from an ADR URL.
 * Uses the last meaningful path segment or filename.
 */
export function getAdrDisplayName(url: string): string {
    const calmMatch = url.match(CALM_HUB_ADR_PATTERN);
    if (calmMatch) {
        return `ADR ${calmMatch[2]} (${calmMatch[1]})`;
    }
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split('/').filter(Boolean);
        return segments[segments.length - 1] || url;
    } catch {
        // Not a full URL — use the last path segment
        const segments = url.split('/').filter(Boolean);
        return segments[segments.length - 1] || url;
    }
}

/**
 * Check if an ADR URL is an internal calm-hub link.
 */
export function isCalmHubAdr(url: string): boolean {
    return CALM_HUB_ADR_PATTERN.test(url);
}

/**
 * Convert a calm-hub ADR API path to an in-app hash route.
 * /calm/namespaces/workshop/adrs/1 → /workshop/adrs/1/1
 */
export function toAdrAppRoute(url: string): string {
    const match = url.match(CALM_HUB_ADR_PATTERN);
    if (match) {
        return `/${match[1]}/adrs/${match[2]}/1`;
    }
    return url;
}
