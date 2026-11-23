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
            .slice(0, 12)
            .map((o) => ({ ...o, apply: `${before}${o.label} ` }));
    }

    // Two letters at least, so the list does not flash open on the first letter of a word.
    const keyMatch = /(?:^|\s)([A-Za-z]{2,})$/.exec(query);
    if (keyMatch) {
        const partial = keyMatch[1].toLowerCase();
        const before = query.slice(0, query.length - keyMatch[1].length);
        return QUALIFIERS
            .filter((q) => q.key.startsWith(partial) || (partial === 'ns' && q.key === 'namespace'))
            .map((q) => ({ label: `${q.key}:`, description: q.description, apply: `${before}${q.key}:` }));
    }
    return [];
}

/** Tailwind classes for each kind of query segment, shared by every highlighted query. */
export const SEGMENT_CLASS = {
    text: 'text-base-content',
    key: 'text-primary',
    value: 'text-accent',
    invalid: 'text-error underline decoration-wavy',
} as const;

/** True while the last qualifier has no value yet, such as `namespace:`. Searching then shows nothing useful. */
export function hasUnfinishedQualifier(query: string): boolean {
    return /(?:^|\s)(namespace|ns|type):\s*$/i.test(query);
}
