/**
 * CALM Hub treats an empty namespace selection as "every namespace". VS Code also
 * reports an unset string array as `[]`, so `undefined`, `null` and `[]` all mean
 * the same thing. The canvas panel and the status bar both resolve the selection
 * through this function so the rule lives in one place (#3493).
 */
export function resolveSelectedNamespaces(
    available: readonly string[],
    selection: readonly string[] | null | undefined
): string[] {
    if (!selection || selection.length === 0) {
        return [...available];
    }
    return available.filter((namespace) => selection.includes(namespace));
}
