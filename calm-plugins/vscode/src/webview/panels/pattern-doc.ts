// Pure converter: CALM architecture document → pattern JSON Schema.
// Each node becomes a prefixItem with const-constrained identity fields;
// each relationship becomes a prefixItem with const-constrained endpoints.

interface PatternNode {
    'unique-id': string;
    'node-type': string;
    name: string;
    description?: string;
    interfaces?: unknown[];
    [key: string]: unknown;
}

interface PatternRelationship {
    'unique-id': string;
    'relationship-type'?: Record<string, unknown>;
    [key: string]: unknown;
}

interface CalmDocument {
    nodes?: PatternNode[];
    relationships?: PatternRelationship[];
    [key: string]: unknown;
}

const CALM_CORE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
const CALM_REL_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship';
const CALM_PATTERN_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

const SKIP_KEYS = new Set(['$schema', '$id', 'type']);

function valueToSchema(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        return { type: 'array', prefixItems: value.map(valueToSchema) };
    }
    if (typeof value === 'object') {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SKIP_KEYS.has(k)) continue;
            const s = valueToSchema(v);
            if (s !== undefined) props[k] = s;
        }
        return { type: 'object', properties: props };
    }
    return { const: value };
}

function nodeToSchemaItem(node: PatternNode): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
        if (SKIP_KEYS.has(key) || value === undefined) continue;
        props[key] = valueToSchema(value);
    }
    return { $ref: CALM_CORE_REF, type: 'object', properties: props };
}

function relationshipToSchemaItem(rel: PatternRelationship): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rel)) {
        if (SKIP_KEYS.has(key) || value === undefined) continue;
        props[key] = valueToSchema(value);
    }
    return { $ref: CALM_REL_REF, type: 'object', properties: props };
}

export function generateId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function exportAsPattern(
    doc: CalmDocument,
    patternName: string
): { json: string; fileName: string } {
    const nodes = doc.nodes ?? [];
    const relationships = doc.relationships ?? [];
    const slug = generateId(patternName);

    const pattern: Record<string, unknown> = {
        $schema: CALM_PATTERN_SCHEMA,
        $id: `patterns/${slug}.pattern.json`,
        type: 'object',
        title: patternName,
        description: `Pattern derived from architecture: ${patternName}`,
        properties: {
            nodes: {
                type: 'array',
                minItems: nodes.length,
                prefixItems: nodes.map(nodeToSchemaItem),
            },
            relationships: {
                type: 'array',
                minItems: relationships.length,
                prefixItems: relationships.map(relationshipToSchemaItem),
            },
        },
        required: ['nodes', 'relationships'],
    };

    return {
        json: JSON.stringify(pattern, null, 2),
        fileName: `${slug}.pattern.json`,
    };
}
