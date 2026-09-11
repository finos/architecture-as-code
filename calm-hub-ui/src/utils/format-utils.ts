/** `encryption-algorithm` / `contributing_factors` -> `Encryption Algorithm`. */
export function formatFieldName(field: string): string {
    return field
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
