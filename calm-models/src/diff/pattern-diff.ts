import type { CalmNodeSchema, CalmRelationshipSchema } from '../types/index.js';
import type { DiffResult } from './diff-types.js';
import { canonicalKey, diffNodesAndRelationships } from './diff.js';

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

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
    return isObject(value) && Object.keys(value).length > 0;
}

/**
 * Whether a prefix item is meant to pin a single node/relationship — i.e. it
 * declares a `unique-id` property. Decision/options wrappers (`oneOf`/`anyOf`/
 * `options`) and bare `$ref` placeholders don't, so when they collapse to
 * nothing comparable they're skipped rather than reported as undiffable.
 */
function declaresUniqueId(item: SchemaObject): boolean {
    return isObject(item['properties']) && 'unique-id' in (item['properties'] as SchemaObject);
}

interface PatternPartition {
    /** Collapsed items with a `const`-pinned `unique-id`: diffable by identity. */
    pinned: Record<string, unknown>[];
    /** Collapsed items without a pinned `unique-id` but with comparable content. */
    content: Record<string, unknown>[];
    /** Items that declare a node/relationship but pin nothing comparable. */
    undiffable: unknown[];
}

/**
 * Collapses each (already alternative-expanded) prefix item and sorts it into:
 * `pinned` (has a `const` `unique-id` → diff by id), `content` (no pinned id but
 * still constrains fields → diff by content), or `undiffable` (declares a
 * node/relationship but pins nothing comparable). Unconstrained decision/options
 * constructs that don't declare a `unique-id` are skipped entirely.
 */
function partitionPrefixItems(prefixItems: SchemaObject[]): PatternPartition {
    const pinned: Record<string, unknown>[] = [];
    const content: Record<string, unknown>[] = [];
    const undiffable: unknown[] = [];
    for (const item of expandAlternatives(prefixItems)) {
        const collapsed = collapseSchema(item);
        if (hasUniqueId(collapsed)) {
            pinned.push(collapsed);
        } else if (isNonEmptyObject(collapsed)) {
            content.push(collapsed);
        } else if (declaresUniqueId(item)) {
            undiffable.push(isObject(collapsed) ? collapsed : item);
        }
    }
    return { pinned, content, undiffable };
}

function partitionPattern(pattern: unknown): { nodes: PatternPartition; relationships: PatternPartition } {
    if (!isObject(pattern)) {
        return {
            nodes: { pinned: [], content: [], undiffable: [] },
            relationships: { pinned: [], content: [], undiffable: [] },
        };
    }
    return {
        nodes: partitionPrefixItems(getPrefixItems(pattern, 'nodes')),
        relationships: partitionPrefixItems(getPrefixItems(pattern, 'relationships')),
    };
}

/**
 * Order-insensitive multiset diff of two lists of id-less items matched by
 * canonical content. Equal content present on both sides is `same`; surplus on
 * one side is `added`/`removed`. There is no `modified`: with no `unique-id` to
 * anchor identity, a content change is an add plus a remove.
 */
function contentMultisetDiff(
    listA: Record<string, unknown>[],
    listB: Record<string, unknown>[],
): {
    added: Record<string, unknown>[];
    removed: Record<string, unknown>[];
    same: Record<string, unknown>[];
} {
    const index = (list: Record<string, unknown>[]) => {
        const counts = new Map<string, { item: Record<string, unknown>; count: number }>();
        for (const item of list) {
            const key = canonicalKey(item);
            const entry = counts.get(key);
            if (entry) entry.count++;
            else counts.set(key, { item, count: 1 });
        }
        return counts;
    };

    const indexA = index(listA);
    const indexB = index(listB);
    const added: Record<string, unknown>[] = [];
    const removed: Record<string, unknown>[] = [];
    const same: Record<string, unknown>[] = [];

    for (const key of new Set([...indexA.keys(), ...indexB.keys()])) {
        const entryA = indexA.get(key);
        const entryB = indexB.get(key);
        const countA = entryA?.count ?? 0;
        const countB = entryB?.count ?? 0;
        const representative = (entryB ?? entryA)!.item;
        for (let i = 0; i < Math.min(countA, countB); i++) same.push(representative);
        for (let i = 0; i < countB - countA; i++) added.push(entryB!.item);
        for (let i = 0; i < countA - countB; i++) removed.push(entryA!.item);
    }

    return { added, removed, same };
}

/**
 * Reduces a CALM pattern (a JSON Schema) to the instance-shaped
 * `{ nodes, relationships }` it constrains. Both `const`-pinned items and
 * id-less-but-constrained items are included. Items that pin nothing comparable
 * are omitted (see {@link diffPatterns} for how they're surfaced). Exposed as a
 * public helper for callers that want the reduced instance; {@link diffPatterns}
 * itself works off the lower-level partition rather than this.
 */
export function normalisePatternToInstance(pattern: unknown): {
    nodes: CalmNodeSchema[];
    relationships: CalmRelationshipSchema[];
} {
    const { nodes, relationships } = partitionPattern(pattern);
    return {
        nodes: [...nodes.pinned, ...nodes.content] as unknown as CalmNodeSchema[],
        relationships: [...relationships.pinned, ...relationships.content] as unknown as CalmRelationshipSchema[],
    };
}

/**
 * Diffs two CALM patterns. Items with a `const`-pinned `unique-id` are diffed by
 * identity (add/remove/modify/rename) via the shared diff core. Id-less items
 * that still constrain content are diffed by content as an order-insensitive
 * multiset (add/remove/same — never modified). Items that pin nothing comparable
 * are reported under `undiffableItems` and contribute to `hasChanges` so
 * `--exit-code` doesn't pass on them silently. Returns the same `DiffResult`
 * shape as {@link diffArchitectures}.
 */
export function diffPatterns(patternA: unknown, patternB: unknown): DiffResult {
    const a = partitionPattern(patternA);
    const b = partitionPattern(patternB);

    // Pass 1 — identity: const-pinned items, keyed by unique-id.
    const result = diffNodesAndRelationships(
        a.nodes.pinned as unknown as CalmNodeSchema[],
        b.nodes.pinned as unknown as CalmNodeSchema[],
        a.relationships.pinned as unknown as CalmRelationshipSchema[],
        b.relationships.pinned as unknown as CalmRelationshipSchema[],
    );

    // Pass 2 — content: id-less-but-constrained items, matched by canonical
    // content as an order-insensitive multiset. These flow into the normal
    // add/remove/same buckets alongside the identity-matched items.
    const nodeContent = contentMultisetDiff(a.nodes.content, b.nodes.content);
    const relContent = contentMultisetDiff(a.relationships.content, b.relationships.content);
    result.nodesAdded.push(...(nodeContent.added as unknown as CalmNodeSchema[]));
    result.nodesRemoved.push(...(nodeContent.removed as unknown as CalmNodeSchema[]));
    result.nodesSame.push(...(nodeContent.same as unknown as CalmNodeSchema[]));
    result.edgesAdded.push(...(relContent.added as unknown as CalmRelationshipSchema[]));
    result.edgesRemoved.push(...(relContent.removed as unknown as CalmRelationshipSchema[]));
    result.edgesSame.push(...(relContent.same as unknown as CalmRelationshipSchema[]));

    // Undiffable: legitimate pattern slots that pin nothing comparable.
    const undiffableNodes = [...a.nodes.undiffable, ...b.nodes.undiffable];
    const undiffableRelationships = [...a.relationships.undiffable, ...b.relationships.undiffable];
    if (undiffableNodes.length > 0 || undiffableRelationships.length > 0) {
        result.undiffableItems = {
            nodes: undiffableNodes,
            relationships: undiffableRelationships,
        };
    }

    return result;
}
