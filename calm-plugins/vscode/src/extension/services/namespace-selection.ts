/**
 * Resolve the `calm.hub.selectedNamespaces` setting against the namespaces the
 * Hub lists.
 *
 * CALM Hub has no namespace selection of its own: the filter is this plugin's
 * setting. VS Code reports an unset string array as `[]`, so `undefined`, `null`
 * and `[]` all mean "every namespace".
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
