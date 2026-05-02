import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import type {
    DiffResult,
    NodeChange,
    RelationshipChange,
    RenameMapping,
    RelationshipRenameMapping,
} from '../model/diff.js';

/**
 * Compares two CALM architectures and returns a detailed diff result.
 * Detects additions, removals, modifications, and renames.
 */
export function diffArchitectures(archA: CalmArchitectureSchema, archB: CalmArchitectureSchema): DiffResult {
    // Filter out nodes and relationships without unique-ids
    const validNodesA = (archA.nodes || []).filter((n) => n['unique-id']);
    const validNodesB = (archB.nodes || []).filter((n) => n['unique-id']);
    const validEdgesA = (archA.relationships || []).filter((r) => r['unique-id']);
    const validEdgesB = (archB.relationships || []).filter((r) => r['unique-id']);

    const nodesA = new Map(validNodesA.map((n) => [n['unique-id'], n]));
    const nodesB = new Map(validNodesB.map((n) => [n['unique-id'], n]));

    const edgesA = new Map(validEdgesA.map((r) => [r['unique-id'], r]));
    const edgesB = new Map(validEdgesB.map((r) => [r['unique-id'], r]));

    // Find removed and added nodes
    const nodesRemovedList = Array.from(nodesA.values()).filter((n) => !nodesB.has(n['unique-id']));
    const nodesAddedList = Array.from(nodesB.values()).filter((n) => !nodesA.has(n['unique-id']));

    // Detect node renames
    const nodesRenamed: RenameMapping[] = [];
    const nodesRemovedUnmatched = new Set(nodesRemovedList.map((n) => n['unique-id']));
    const nodesAddedUnmatched = new Set(nodesAddedList.map((n) => n['unique-id']));

    for (const removedNode of nodesRemovedList) {
        for (const addedNode of nodesAddedList) {
            if (nodeStructureMatches(removedNode, addedNode)) {
                nodesRenamed.push({
                    oldId: removedNode['unique-id'],
                    newId: addedNode['unique-id'],
                    node: addedNode,
                });
                nodesRemovedUnmatched.delete(removedNode['unique-id']);
                nodesAddedUnmatched.delete(addedNode['unique-id']);
                break;
            }
        }
    }

    // Find removed and added edges
    const edgesRemovedList = Array.from(edgesA.values()).filter((e) => !edgesB.has(e['unique-id']));
    const edgesAddedList = Array.from(edgesB.values()).filter((e) => !edgesA.has(e['unique-id']));

    // Detect edge renames
    const edgesRenamed: RelationshipRenameMapping[] = [];
    const edgesRemovedUnmatched = new Set(edgesRemovedList.map((e) => e['unique-id']));
    const edgesAddedUnmatched = new Set(edgesAddedList.map((e) => e['unique-id']));

    for (const removedEdge of edgesRemovedList) {
        for (const addedEdge of edgesAddedList) {
            if (relationshipStructureMatches(removedEdge, addedEdge)) {
                edgesRenamed.push({
                    oldId: removedEdge['unique-id'],
                    newId: addedEdge['unique-id'],
                    relationship: addedEdge,
                });
                edgesRemovedUnmatched.delete(removedEdge['unique-id']);
                edgesAddedUnmatched.delete(addedEdge['unique-id']);
                break;
            }
        }
    }

    // Find modified and same nodes
    const nodesModified: NodeChange[] = [];
    const nodesSame: typeof nodesA.values extends () => IterableIterator<infer T> ? T[] : never = [];

    for (const [id, nodeA] of nodesA.entries()) {
        if (!nodesB.has(id) || nodesRenamed.some((r) => r.newId === id)) {
            continue;
        }
        const nodeB = nodesB.get(id)!;
        if (JSON.stringify(nodeA) !== JSON.stringify(nodeB)) {
            nodesModified.push({ original: nodeA, updated: nodeB });
        } else {
            nodesSame.push(nodeA);
        }
    }

    // Find modified and same edges
    const edgesModified: RelationshipChange[] = [];
    const edgesSame: typeof edgesA.values extends () => IterableIterator<infer T> ? T[] : never = [];

    for (const [id, edgeA] of edgesA.entries()) {
        if (!edgesB.has(id) || edgesRenamed.some((r) => r.newId === id)) {
            continue;
        }
        const edgeB = edgesB.get(id)!;
        if (JSON.stringify(edgeA) !== JSON.stringify(edgeB)) {
            edgesModified.push({ original: edgeA, updated: edgeB });
        } else {
            edgesSame.push(edgeA);
        }
    }

    return {
        nodesAdded: Array.from(nodesAddedUnmatched).map((id) => nodesB.get(id)!),
        nodesRemoved: Array.from(nodesRemovedUnmatched).map((id) => nodesA.get(id)!),
        nodesModified,
        nodesSame,
        nodesRenamed,

        edgesAdded: Array.from(edgesAddedUnmatched).map((id) => edgesB.get(id)!),
        edgesRemoved: Array.from(edgesRemovedUnmatched).map((id) => edgesA.get(id)!),
        edgesModified,
        edgesSame,
        edgesRenamed,
    };
}

/**
 * Checks if two nodes are structurally identical, ignoring their unique-id.
 * Used to detect renames.
 */
export function nodeStructureMatches(nodeA: any, nodeB: any): boolean {
    const { 'unique-id': _idA, ...propsA } = nodeA;
    const { 'unique-id': _idB, ...propsB } = nodeB;
    return JSON.stringify(propsA) === JSON.stringify(propsB);
}

/**
 * Checks if two relationships are structurally identical, ignoring their unique-id.
 * Used to detect renames.
 */
export function relationshipStructureMatches(relA: any, relB: any): boolean {
    const { 'unique-id': _idA, ...propsA } = relA;
    const { 'unique-id': _idB, ...propsB } = relB;
    return JSON.stringify(propsA) === JSON.stringify(propsB);
}
