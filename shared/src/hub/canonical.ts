/**
 * Recursively sort object keys so two documents with the same content but different key ordering
 * compare equal. Array order is preserved.
 */
export function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).sort()) {
            sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
        }
        return sorted;
    }
    return value;
}

/**
 * Deep content equality that ignores object key ordering (array order is preserved). Used to decide
 * whether a local CALM document differs from the version CalmHub has already published.
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}
