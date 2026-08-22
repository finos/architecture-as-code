export function mergeControls(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    const result = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (!(key in result)) {
            result[key] = JSON.parse(JSON.stringify(value));
        }
    }
    return result;
}
