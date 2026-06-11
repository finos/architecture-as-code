import type {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../types/index.js';
import type {
    DiffResult,
    NodeChange,
    RelationshipChange,
    RenameMapping,
    RelationshipRenameMapping,
} from './diff-types.js';

function normalizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }
    if (value !== null && typeof value === 'object') {
        const normalized: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeValue((value as Record<string, unknown>)[key]);
        }
        return normalized;
    }
    return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

/**
 * A stable content key for a value: object keys are sorted recursively before
 * serialising, so two values differing only in object-key order produce the
 * same key. Array element order is preserved (and therefore significant),
 * matching {@link valuesEqual}. Used by the pattern diff to match id-less items
 * by content.
 */
export function canonicalKey(value: unknown): string {
    return JSON.stringify(normalizeValue(value));
}

function omitUniqueId(item: Record<string, unknown>): Record<string, unknown> {
    const { 'unique-id': _omit, ...rest } = item;
    void _omit;
    return rest;
}

export function nodeStructureMatches(a: CalmNodeSchema, b: CalmNodeSchema): boolean {
    return valuesEqual(
        omitUniqueId(a as Record<string, unknown>),
        omitUniqueId(b as Record<string, unknown>),
    );
}

export function relationshipStructureMatches(
    a: CalmRelationshipSchema,
    b: CalmRelationshipSchema,
): boolean {
    return valuesEqual(
        omitUniqueId(a as Record<string, unknown>),
        omitUniqueId(b as Record<string, unknown>),
    );
}

export function diffArchitectures(
    archA: CalmArchitectureSchema,
    archB: CalmArchitectureSchema,
): DiffResult {
    return diffNodesAndRelationships(
        archA.nodes ?? [],
        archB.nodes ?? [],
        archA.relationships ?? [],
        archB.relationships ?? [],
    );
}

/**
 * Core diff over the node/relationship arrays that both architectures and
 * (normalised) patterns reduce to. Matching is by `unique-id`; items missing
 * one are surfaced via `invalidItems` rather than silently dropped.
 */
export function diffNodesAndRelationships(
    allNodesA: CalmNodeSchema[],
    allNodesB: CalmNodeSchema[],
    allEdgesA: CalmRelationshipSchema[],
    allEdgesB: CalmRelationshipSchema[],
): DiffResult {
    const validNodesA = allNodesA.filter((n) => n['unique-id']);
    const validNodesB = allNodesB.filter((n) => n['unique-id']);
    const validEdgesA = allEdgesA.filter((r) => r['unique-id']);
    const validEdgesB = allEdgesB.filter((r) => r['unique-id']);

    const invalidNodes = [
        ...allNodesA.filter((n) => !n['unique-id']),
        ...allNodesB.filter((n) => !n['unique-id']),
    ];
    const invalidEdges = [
        ...allEdgesA.filter((r) => !r['unique-id']),
        ...allEdgesB.filter((r) => !r['unique-id']),
    ];

    const nodesA = new Map(validNodesA.map((n) => [n['unique-id'] as string, n]));
    const nodesB = new Map(validNodesB.map((n) => [n['unique-id'] as string, n]));
    const edgesA = new Map(validEdgesA.map((r) => [r['unique-id'] as string, r]));
    const edgesB = new Map(validEdgesB.map((r) => [r['unique-id'] as string, r]));

    const nodesRemovedList = [...nodesA.values()].filter((n) => !nodesB.has(n['unique-id'] as string));
    const nodesAddedList = [...nodesB.values()].filter((n) => !nodesA.has(n['unique-id'] as string));

    const nodesRenamed: RenameMapping[] = [];
    const nodesRemovedUnmatched = new Set(nodesRemovedList.map((n) => n['unique-id'] as string));
    const nodesAddedUnmatched = new Set(nodesAddedList.map((n) => n['unique-id'] as string));

    for (const removed of nodesRemovedList) {
        for (const added of nodesAddedList) {
            const addedId = added['unique-id'] as string;
            if (!nodesAddedUnmatched.has(addedId)) continue;
            if (nodeStructureMatches(removed, added)) {
                nodesRenamed.push({
                    oldId: removed['unique-id'] as string,
                    newId: addedId,
                    node: added,
                });
                nodesRemovedUnmatched.delete(removed['unique-id'] as string);
                nodesAddedUnmatched.delete(addedId);
                break;
            }
        }
    }

    const edgesRemovedList = [...edgesA.values()].filter((e) => !edgesB.has(e['unique-id'] as string));
    const edgesAddedList = [...edgesB.values()].filter((e) => !edgesA.has(e['unique-id'] as string));

    const edgesRenamed: RelationshipRenameMapping[] = [];
    const edgesRemovedUnmatched = new Set(edgesRemovedList.map((e) => e['unique-id'] as string));
    const edgesAddedUnmatched = new Set(edgesAddedList.map((e) => e['unique-id'] as string));

    for (const removed of edgesRemovedList) {
        for (const added of edgesAddedList) {
            const addedId = added['unique-id'] as string;
            if (!edgesAddedUnmatched.has(addedId)) continue;
            if (relationshipStructureMatches(removed, added)) {
                edgesRenamed.push({
                    oldId: removed['unique-id'] as string,
                    newId: addedId,
                    relationship: added,
                });
                edgesRemovedUnmatched.delete(removed['unique-id'] as string);
                edgesAddedUnmatched.delete(addedId);
                break;
            }
        }
    }

    const nodesModified: NodeChange[] = [];
    const nodesSame: CalmNodeSchema[] = [];
    for (const [id, nodeA] of nodesA) {
        if (!nodesB.has(id)) continue;
        const nodeB = nodesB.get(id)!;
        if (valuesEqual(nodeA, nodeB)) {
            nodesSame.push(nodeA);
        } else {
            nodesModified.push({ original: nodeA, updated: nodeB });
        }
    }

    const edgesModified: RelationshipChange[] = [];
    const edgesSame: CalmRelationshipSchema[] = [];
    for (const [id, edgeA] of edgesA) {
        if (!edgesB.has(id)) continue;
        const edgeB = edgesB.get(id)!;
        if (valuesEqual(edgeA, edgeB)) {
            edgesSame.push(edgeA);
        } else {
            edgesModified.push({ original: edgeA, updated: edgeB });
        }
    }

    return {
        nodesAdded: [...nodesAddedUnmatched].map((id) => nodesB.get(id)!),
        nodesRemoved: [...nodesRemovedUnmatched].map((id) => nodesA.get(id)!),
        nodesModified,
        nodesSame,
        nodesRenamed,
        edgesAdded: [...edgesAddedUnmatched].map((id) => edgesB.get(id)!),
        edgesRemoved: [...edgesRemovedUnmatched].map((id) => edgesA.get(id)!),
        edgesModified,
        edgesSame,
        edgesRenamed,
        invalidItems: {
            nodes: invalidNodes,
            relationships: invalidEdges,
        },
    };
}
