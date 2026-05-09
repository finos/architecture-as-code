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
    const validNodesA = (archA.nodes ?? []).filter((n) => n['unique-id']);
    const validNodesB = (archB.nodes ?? []).filter((n) => n['unique-id']);
    const validEdgesA = (archA.relationships ?? []).filter((r) => r['unique-id']);
    const validEdgesB = (archB.relationships ?? []).filter((r) => r['unique-id']);

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
    };
}
