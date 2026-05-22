import type { CalmNodeSchema, CalmRelationshipSchema } from '../types/index.js';
import type { DiffResult } from './diff-types.js';
import { diffNodesAndRelationships } from './diff.js';

type SchemaObject = Record<string, unknown>;

function isObject(value: unknown): value is SchemaObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collapses a JSON Schema fragment into the instance value it fixes, recursing
 * through `const`, `properties` and `prefixItems`. Returns `undefined` when the
 * fragment constrains nothing concrete, so unconstrained keys are omitted from
 * the resulting instance (and therefore don't register as diffs).
 */
function collapseSchema(schema: unknown): unknown {
    if (!isObject(schema)) return undefined;

    if ('const' in schema) return schema['const'];

    if (isObject(schema['properties'])) {
        const result: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(schema['properties'])) {
            if (key.startsWith('$')) continue;
            const value = collapseSchema(child);
            if (value !== undefined) result[key] = value;
        }
        return Object.keys(result).length > 0 ? result : undefined;
    }

    if (Array.isArray(schema['prefixItems'])) {
        const items = schema['prefixItems']
            .map(collapseSchema)
            .filter((value) => value !== undefined);
        return items.length > 0 ? items : undefined;
    }

    return undefined;
}

/**
 * Reads the `prefixItems` for a top-level pattern field (e.g. `nodes`,
 * `relationships`), handling both direct `properties` and `allOf` wrapping.
 */
function getPrefixItems(pattern: SchemaObject, key: string): SchemaObject[] {
    const direct = isObject(pattern['properties'])
        ? pattern['properties'][key]
        : undefined;
    if (isObject(direct) && Array.isArray(direct['prefixItems'])) {
        return direct['prefixItems'] as SchemaObject[];
    }

    if (Array.isArray(pattern['allOf'])) {
        for (const sub of pattern['allOf']) {
            if (!isObject(sub) || !isObject(sub['properties'])) continue;
            const field = sub['properties'][key];
            if (isObject(field) && Array.isArray(field['prefixItems'])) {
                return field['prefixItems'] as SchemaObject[];
            }
        }
    }

    return [];
}

/**
 * Expands `oneOf`/`anyOf` decision wrappers so each alternative is diffed as an
 * individual item by its own `unique-id`.
 */
function expandAlternatives(prefixItems: SchemaObject[]): SchemaObject[] {
    const expanded: SchemaObject[] = [];
    for (const item of prefixItems) {
        const alternatives = Array.isArray(item['oneOf'])
            ? item['oneOf']
            : Array.isArray(item['anyOf'])
                ? item['anyOf']
                : null;
        if (alternatives) {
            for (const alt of alternatives) {
                if (isObject(alt)) expanded.push(alt);
            }
        } else {
            expanded.push(item);
        }
    }
    return expanded;
}

function hasUniqueId(value: unknown): value is Record<string, unknown> {
    return isObject(value) && typeof value['unique-id'] === 'string';
}

/**
 * Reduces a CALM pattern (a JSON Schema) to the instance-shaped
 * `{ nodes, relationships }` it constrains, keyed by `unique-id`. This is the
 * same reduction the Hub UI's pattern visualiser performs for rendering, so the
 * diff lines up with what users see on the graph.
 */
export function normalisePatternToInstance(pattern: unknown): {
    nodes: CalmNodeSchema[];
    relationships: CalmRelationshipSchema[];
} {
    if (!isObject(pattern)) {
        return { nodes: [], relationships: [] };
    }

    const nodes = expandAlternatives(getPrefixItems(pattern, 'nodes'))
        .map(collapseSchema)
        .filter(hasUniqueId) as CalmNodeSchema[];

    const relationships = expandAlternatives(getPrefixItems(pattern, 'relationships'))
        .map(collapseSchema)
        .filter(hasUniqueId) as CalmRelationshipSchema[];

    return { nodes, relationships };
}

/**
 * Diffs two CALM patterns by normalising each schema to its constrained
 * `{ nodes, relationships }` and delegating to the shared diff core. Returns the
 * same `DiffResult` shape as {@link diffArchitectures}.
 */
export function diffPatterns(patternA: unknown, patternB: unknown): DiffResult {
    const a = normalisePatternToInstance(patternA);
    const b = normalisePatternToInstance(patternB);
    return diffNodesAndRelationships(a.nodes, b.nodes, a.relationships, b.relationships);
}
