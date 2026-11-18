export type QualifierKey = 'namespace' | 'type';

export interface QualifierInfo {
    key: QualifierKey;
    description: string;
}

export const QUALIFIERS: QualifierInfo[] = [
    { key: 'namespace', description: 'Only show results from one namespace' },
    { key: 'type', description: 'Only show one kind of resource' },
];

// Must match SearchQuery.TYPE_ALIASES in calm-hub.
export const SEARCH_TYPES: { value: string; description: string }[] = [
    { value: 'architecture', description: 'Architectures' },
    { value: 'pattern', description: 'Patterns' },
    { value: 'flow', description: 'Flows' },
    { value: 'standard', description: 'Standards' },
    { value: 'interface', description: 'Interfaces' },
    { value: 'control', description: 'Controls (by domain)' },
    { value: 'adr', description: 'Architecture decision records' },
];

export const SEARCH_PLACEHOLDER_HINT = 'namespace:finos type:pattern';

// Mirrors SearchQuery.QUALIFIER in calm-hub, so what is highlighted is what the server applies.
const QUALIFIER = /\b(namespace|ns|type):(\s*)([A-Za-z0-9._-]*)/gi;

/** Whether the query has a qualifier that the server applies, which needs a value. */
export function hasQualifiers(query: string): boolean {
    return /\b(namespace|ns|type):\s*[A-Za-z0-9._-]/i.test(query);
}

export interface QuerySegment {
    text: string;
    kind: 'text' | 'key' | 'value' | 'invalid';
}

function canonicalKey(key: string): QualifierKey {
    return key.toLowerCase() === 'type' ? 'type' : 'namespace';
}

function isKnownType(value: string): boolean {
    const singular = value.toLowerCase().replace(/s$/, '');
    return SEARCH_TYPES.some((t) => t.value === singular);
}

export function segmentQuery(query: string): QuerySegment[] {
    const segments: QuerySegment[] = [];
    let last = 0;
    for (const match of query.matchAll(QUALIFIER)) {
        const [whole, key, gap, value] = match;
        const start = match.index ?? 0;
        if (start > last) segments.push({ text: query.slice(last, start), kind: 'text' });
        segments.push({ text: `${key}:${gap}`, kind: 'key' });
        if (value) {
            const invalid = canonicalKey(key) === 'type' && !isKnownType(value);
            segments.push({ text: value, kind: invalid ? 'invalid' : 'value' });
        }
        last = start + whole.length;
    }
    if (last < query.length) segments.push({ text: query.slice(last), kind: 'text' });
    return segments;
}

function matchRank(label: string, partial: string): number {
    const lower = label.toLowerCase();
    if (lower === partial) return 0;
    return lower.startsWith(partial) ? 1 : 2;
}

export interface Suggestion {
    /** A `key` completes a qualifier name, a `value` completes what follows its colon. */
    kind: 'key' | 'value';
    label: string;
    description?: string;
    /** The query after the suggestion is accepted. */
    apply: string;
}

/**
 * Suggestions for the token at the end of the query: a qualifier key while one is being typed,
 * then its values after the colon.
 */
export function suggest(query: string, namespaces: string[]): Suggestion[] {
    const valueMatch = /(?:^|\s)(namespace|ns|type):\s*([A-Za-z0-9._-]*)$/i.exec(query);
    if (valueMatch) {
        const partial = valueMatch[2].toLowerCase();
        const before = query.slice(0, query.length - valueMatch[2].length);
        const options = canonicalKey(valueMatch[1]) === 'type'
            ? SEARCH_TYPES.map((t) => ({ label: t.value, description: t.description }))
            : namespaces.map((ns) => ({ label: ns, description: undefined }));
        return options
            .filter((o) => o.label.toLowerCase().includes(partial))
            .sort((a, b) => matchRank(a.label, partial) - matchRank(b.label, partial))
            .map((o) => ({ ...o, kind: 'value' as const, apply: `${before}${o.label} ` }));
    }

    const keyMatch = /(?:^|\s)([A-Za-z]+)$/.exec(query);
    if (keyMatch) {
        const partial = keyMatch[1].toLowerCase();
        const before = query.slice(0, query.length - keyMatch[1].length);
        return QUALIFIERS
            .filter((q) => q.key.startsWith(partial) || (partial === 'ns' && q.key === 'namespace'))
            .map((q) => ({ kind: 'key' as const, label: `${q.key}:`, description: q.description, apply: `${before}${q.key}:` }));
    }
    return [];
}
