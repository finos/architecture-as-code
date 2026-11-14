/** Resolves an RFC 6901 JSON Pointer. Undefined when any step is missing. */
export function resolvePointer(value: unknown, pointer: string): unknown {
    if (pointer === '') return value;
    if (!pointer.startsWith('/')) return undefined;
    let current = value;
    for (const raw of pointer.slice(1).split('/')) {
        const token = raw.replace(/~1/g, '/').replace(/~0/g, '~');
        if (Array.isArray(current)) {
            if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
            current = current[Number(token)];
        } else if (current !== null && typeof current === 'object' && Object.hasOwn(current, token)) {
            current = (current as Record<string, unknown>)[token];
        } else {
            return undefined;
        }
    }
    return current;
}
