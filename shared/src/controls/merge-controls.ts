export function mergeControls(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (!Object.prototype.hasOwnProperty.call(merged, key)) {
            merged[key] = structuredClone(value);
        }
    }
    return merged;
}
