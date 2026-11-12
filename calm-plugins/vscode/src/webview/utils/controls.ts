// TODO: Replace this local implementation with a re-export from @finos/calm-shared
// once the vscode plugin adds @finos/calm-shared as a dependency.
// The canonical implementation lives in shared/src/controls/merge-controls.ts.
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
