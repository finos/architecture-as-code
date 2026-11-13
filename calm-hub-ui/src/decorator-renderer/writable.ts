/** The read API's field names, and the names that a decorator write takes. */
const WRITE_FIELDS: readonly [string, string][] = [
    ['schema', '$schema'],
    ['uniqueId', 'unique-id'],
    ['type', 'type'],
    ['target', 'target'],
    ['targetType', 'target-type'],
    ['appliesTo', 'applies-to'],
    ['data', 'data'],
];

/** Hub owns these times, so a write leaves them out. */
const HUB_OWNED_FIELDS: ReadonlySet<string> = new Set(['creationDateTime', 'updateDateTime']);

/**
 * A decorator as a write takes it, so that its JSON can be copied into a PUT: the field names of the write API, and no
 * Hub-owned times. A field that the read API does not name is kept as it is.
 */
export function writableDecorator(decorator: object): Record<string, unknown> {
    const source = decorator as Record<string, unknown>;
    const known = new Set(WRITE_FIELDS.map(([read]) => read));
    const writable: Record<string, unknown> = {};
    for (const [read, write] of WRITE_FIELDS) {
        if (source[read] !== undefined) writable[write] = source[read];
    }
    for (const [field, value] of Object.entries(source)) {
        if (!known.has(field) && !HUB_OWNED_FIELDS.has(field) && !Object.hasOwn(writable, field)) writable[field] = value;
    }
    return writable;
}
