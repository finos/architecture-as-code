import type { CalmNodeSchema, CalmRelationshipSchema } from '../types/index.js';
import type { MinItemsChange, NodesAndRelationshipsDiffResult, ObligationChange, PatternObligation } from './diff-types.js';
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

function alternativesOf(schema: unknown): SchemaObject[] | undefined {
    if (!isObject(schema)) return undefined;
    if (Array.isArray(schema['oneOf'])) return schema['oneOf'] as SchemaObject[];
    if (Array.isArray(schema['anyOf'])) return schema['anyOf'] as SchemaObject[];
    return undefined;
}

/**
 * A pattern may declare a field directly or inside an `allOf` branch, so the
 * first branch carrying what the caller wants is the one that counts.
 */
function findField(
    pattern: SchemaObject,
    key: string,
    carries: (field: SchemaObject) => boolean,
): SchemaObject | undefined {
    const direct = isObject(pattern['properties'])
        ? pattern['properties'][key]
        : undefined;
    if (isObject(direct) && carries(direct)) {
        return direct;
    }

    if (Array.isArray(pattern['allOf'])) {
        for (const sub of pattern['allOf']) {
            if (!isObject(sub) || !isObject(sub['properties'])) continue;
            const field = sub['properties'][key];
            if (isObject(field) && carries(field)) {
                return field;
            }
        }
    }

    return undefined;
}

function getPrefixItems(pattern: SchemaObject, key: string): SchemaObject[] {
    const field = findField(pattern, key, (f) => Array.isArray(f['prefixItems']));
    return (field?.['prefixItems'] as SchemaObject[]) ?? [];
}

/** JSON Schema applies every `minItems` it finds, so the largest one is the limit. */
function getMinItems(pattern: SchemaObject, key: string): number {
    const branches = [pattern, ...(Array.isArray(pattern['allOf']) ? pattern['allOf'] : [])];
    let minItems = 0;
    for (const branch of branches) {
        const field = isObject(branch) && isObject(branch['properties']) ? branch['properties'][key] : undefined;
        if (isObject(field) && typeof field['minItems'] === 'number') {
            minItems = Math.max(minItems, field['minItems']);
        }
    }
    return minItems;
}

/** A catalogue declares its members as the alternatives of `items`. */
function getCatalogueMembers(pattern: SchemaObject, key: string): SchemaObject[] {
    const field = findField(pattern, key, (f) => alternativesOf(f['items']) !== undefined);
    return field ? alternativesOf(field['items'])! : [];
}

/** A pattern can declare an id more than once. The strongest obligation counts. */
const OBLIGATION_STRENGTH: Record<PatternObligation, number> = { required: 2, alternative: 1, catalogue: 0 };

interface Declaration {
    schema: SchemaObject;
    obligation: PatternObligation;
}

/**
 * Lists each item the pattern declares, with `oneOf`/`anyOf` entries expanded
 * so each alternative is diffed by its own `unique-id`. The obligation keeps
 * what the expanded wrapper meant.
 */
function declarationsFor(pattern: SchemaObject, key: string): Declaration[] {
    const declarations: Declaration[] = [];
    for (const item of getPrefixItems(pattern, key)) {
        const alternatives = alternativesOf(item);
        if (alternatives) {
            for (const alt of alternatives) {
                if (isObject(alt)) declarations.push({ schema: alt, obligation: 'alternative' });
            }
        } else {
            declarations.push({ schema: item, obligation: 'required' });
        }
    }
    for (const member of getCatalogueMembers(pattern, key)) {
        if (isObject(member)) declarations.push({ schema: member, obligation: 'catalogue' });
    }
    return declarations;
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
    /** Obligation of each pinned item, by `unique-id`. */
    obligations: Map<string, PatternObligation>;
    /** Collapsed items without a pinned `unique-id` but with comparable content. */
    content: Record<string, unknown>[];
    /** Items that declare a node/relationship but pin nothing comparable. */
    undiffable: unknown[];
}

/**
 * Collapses each (already alternative-expanded) declaration and sorts it into:
 * `pinned` (has a `const` `unique-id` → diff by id), `content` (no pinned id but
 * still constrains fields → diff by content), or `undiffable` (declares a
 * node/relationship but pins nothing comparable). Unconstrained decision/options
 * constructs that don't declare a `unique-id` are skipped entirely.
 */
function partitionDeclarations(declarations: Declaration[]): PatternPartition {
    const pinned: Record<string, unknown>[] = [];
    const obligations = new Map<string, PatternObligation>();
    const content: Record<string, unknown>[] = [];
    const undiffable: unknown[] = [];
    for (const { schema: item, obligation } of declarations) {
        const collapsed = collapseSchema(item);
        if (hasUniqueId(collapsed)) {
            pinned.push(collapsed);
            const id = collapsed['unique-id'] as string;
            const current = obligations.get(id);
            if (current === undefined || OBLIGATION_STRENGTH[obligation] > OBLIGATION_STRENGTH[current]) {
                obligations.set(id, obligation);
            }
        } else if (isNonEmptyObject(collapsed)) {
            content.push(collapsed);
        } else if (declaresUniqueId(item)) {
            undiffable.push(isObject(collapsed) ? collapsed : item);
        }
    }
    return { pinned, obligations, content, undiffable };
}

function partitionPattern(pattern: unknown): { nodes: PatternPartition; relationships: PatternPartition } {
    if (!isObject(pattern)) {
        const empty = (): PatternPartition => ({ pinned: [], obligations: new Map(), content: [], undiffable: [] });
        return { nodes: empty(), relationships: empty() };
    }
    return {
        nodes: partitionDeclarations(declarationsFor(pattern, 'nodes')),
        relationships: partitionDeclarations(declarationsFor(pattern, 'relationships')),
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

function minItemsChange(patternA: unknown, patternB: unknown, key: string): MinItemsChange | undefined {
    const from = isObject(patternA) ? getMinItems(patternA, key) : 0;
    const to = isObject(patternB) ? getMinItems(patternB, key) : 0;
    return from === to ? undefined : { from, to };
}

/** Items that both patterns pin, by `unique-id` or by rename, at a different obligation. */
function obligationChanges(
    a: PatternPartition,
    b: PatternPartition,
    renamed: { oldId: string; newId: string }[],
): ObligationChange<Record<string, unknown>>[] {
    const oldIds = new Map(renamed.map((r) => [r.newId, r.oldId]));
    const itemsB = new Map(b.pinned.map((item) => [item['unique-id'] as string, item]));
    const changes: ObligationChange<Record<string, unknown>>[] = [];
    for (const [id, to] of b.obligations) {
        const from = a.obligations.get(oldIds.get(id) ?? id);
        if (from === undefined || from === to) continue;
        changes.push({ item: itemsB.get(id)!, from, to });
    }
    return changes;
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
 * `--exit-code` doesn't pass on them silently. Pinned items whose obligation
 * changed are reported under `obligationChanged` instead of as same. Returns the same `NodesAndRelationshipsDiffResult`
 * shape as {@link diffNodesAndRelationships}.
 */
export function diffPatterns(patternA: unknown, patternB: unknown): NodesAndRelationshipsDiffResult {
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

    const nodeObligations = obligationChanges(a.nodes, b.nodes, result.nodesRenamed);
    const relObligations = obligationChanges(a.relationships, b.relationships, result.edgesRenamed);
    if (nodeObligations.length > 0 || relObligations.length > 0) {
        const changedNodes = new Set(nodeObligations.map((c) => c.item['unique-id']));
        const changedRels = new Set(relObligations.map((c) => c.item['unique-id']));
        result.nodesSame = result.nodesSame.filter((n) => !changedNodes.has(n['unique-id']));
        result.edgesSame = result.edgesSame.filter((r) => !changedRels.has(r['unique-id']));
        result.obligationChanged = {
            nodes: nodeObligations as unknown as ObligationChange<CalmNodeSchema>[],
            relationships: relObligations as unknown as ObligationChange<CalmRelationshipSchema>[],
        };
    }

    const minItems = {
        nodes: minItemsChange(patternA, patternB, 'nodes'),
        relationships: minItemsChange(patternA, patternB, 'relationships'),
    };
    if (minItems.nodes || minItems.relationships) {
        result.minItemsChanged = minItems;
    }

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
