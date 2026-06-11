/**
 * Extracts a human-readable message from a value thrown in a catch clause.
 *
 * Under strict mode, `catch` bindings are typed `unknown`, so callers cannot
 * assume an `Error`. This narrows that value to its message, falling back to a
 * string coercion for non-Error throws.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
