import { CALM_META_SCHEMA_BASE_URL } from '../../core/calm-schema-release';

// Builds the pattern that "Export as Pattern" saves. Kept apart from CanvasPanel
// so that it can be unit-tested without the VS Code API.

const SKIP_KEYS = new Set(['$schema', '$id', 'type']);

function toSchema(value: unknown): unknown {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return { type: 'array', prefixItems: value.map(toSchema) };
    if (typeof value === 'object') {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SKIP_KEYS.has(k)) continue;
            const s = toSchema(v);
            if (s !== undefined) props[k] = s;
        }
        return { type: 'object', properties: props };
    }
    return { const: value };
}

function itemSchema(entry: Record<string, unknown>, ref: string): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) {
        if (SKIP_KEYS.has(k) || v === undefined) continue;
        props[k] = toSchema(v);
    }
    return { $ref: ref, type: 'object', properties: props };
}

/** The pattern file name and JSON for an architecture document exported under `name`. */
export function buildArchitecturePattern(
    doc: Record<string, unknown>,
    name: string
): { fileName: string; json: string } {
    const title = name.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fileName = `${slug}.pattern.json`;

    const nodes = (doc.nodes ?? []) as Record<string, unknown>[];
    const rels = (doc.relationships ?? []) as Record<string, unknown>[];
    const pattern = {
        $schema: `${CALM_META_SCHEMA_BASE_URL}/calm.json`,
        $id: `patterns/${fileName}`,
        type: 'object',
        title,
        description: `Pattern derived from architecture: ${title}`,
        properties: {
            nodes: {
                type: 'array',
                minItems: nodes.length,
                prefixItems: nodes.map((n) =>
                    itemSchema(n, `${CALM_META_SCHEMA_BASE_URL}/core.json#/defs/node`)
                ),
            },
            relationships: {
                type: 'array',
                minItems: rels.length,
                prefixItems: rels.map((r) =>
                    itemSchema(r, `${CALM_META_SCHEMA_BASE_URL}/core.json#/defs/relationship`)
                ),
            },
        },
        required: ['nodes', 'relationships'],
    };

    return { fileName, json: JSON.stringify(pattern, null, 2) };
}
