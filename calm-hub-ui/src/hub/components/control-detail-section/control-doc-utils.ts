// Shape heuristics and formatting helpers for the readable control-document
// viewer. No JSX — shared by ReadableControlDoc and its child components.

/** `encryption-algorithm` / `contributing_factors` -> `Encryption Algorithm`. */
export function formatFieldName(field: string): string {
    return field
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A requirement document is treated as a JSON Schema when it carries a
 * `properties` object. Both known requirement flavours are disjoint on this key
 * (the prose flavour uses `requirements` / `references` instead), and config
 * instances are flat. A prose document that legitimately carried a `properties`
 * object would render as a schema — accepted, low risk.
 */
export function isJsonSchemaLike(doc: unknown): boolean {
    return isPlainObject(doc) && isPlainObject(doc.properties);
}

export function isUrlString(v: unknown): v is string {
    return typeof v === 'string' && /^https?:\/\//i.test(v.trim());
}

export function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string');
}

/** Keys the schema renderer consumes structurally — never echoed as raw rows. */
export const SCHEMA_STRUCTURAL_KEYS = new Set([
    '$schema',
    '$id',
    'type',
    'required',
    'properties',
    'title',
    'description',
    'additionalProperties',
    'definitions',
    '$defs',
]);

// Keys DocHeader renders (so ReadableControlDoc must not repeat them as body rows).
// `type` is deliberately absent: DocHeader never shows it, so a top-level `type` on
// a non-schema document must fall through to the body rather than vanish. (For a
// JSON-Schema-flavour document `type` is filtered by SCHEMA_STRUCTURAL_KEYS instead.)
export const HEADER_KEYS = new Set([
    '$schema',
    '$id',
    'id',
    'control-id',
    'title',
    'name',
    'description',
    'summary',
    'category',
    'source',
    'url',
]);
