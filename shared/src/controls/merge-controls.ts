export function mergeControls(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (!(key in merged)) {
            merged[key] = JSON.parse(JSON.stringify(value));
        }
    }
    return merged;
}
