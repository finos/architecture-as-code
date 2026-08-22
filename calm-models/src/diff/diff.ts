import { ChangeObject, diffArrays, diffSentences } from 'diff';
import type {
    CalmArchitectureSchema,
    CalmControlDetailSchema,
    CalmControlSchema,
    CalmControlsSchema,
    CalmMetadataSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../types/index.js';
import type {
    NodeChange,
    RelationshipChange,
    RenameMapping,
    RelationshipRenameMapping,
    NodesAndRelationshipsDiffResult,
    AdrDiffResult,
    ArchitectureDiffResult,
    ControlDiffResult,
    ControlItemDiffResult,
    ChangeType,
    MetadataDiffResult,
    MetadataItemDiffResult,
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

function diffControlItem(controlItemA: CalmControlSchema, controlItemB: CalmControlSchema): ControlItemDiffResult {
    const result = {
        descriptionDiff: diffSentences(controlItemA.description, controlItemB.description).map((diff: ChangeObject<string>) => ({
            content: diff.value,
            changeType: getChangeTypeFromChangeObject(diff),
        })),
        requirementsDiff: diffArrays<CalmControlDetailSchema>(controlItemA.requirements, controlItemB.requirements, { comparator: valuesEqual }).flatMap((diff: ChangeObject<CalmControlDetailSchema[]>) => diff.value.map((val: CalmControlDetailSchema) => ({
            content: val,
            changeType: getChangeTypeFromChangeObject(diff),
        })))
    };

    return result;
}

function stringifyMetadata(metadata: CalmMetadataSchema): string[] {
    if (Array.isArray(metadata)) {
        return metadata.map((obj: Record<string, unknown>) => JSON.stringify(obj));
    } else {
        return [JSON.stringify(metadata)];
    }
}

function diffMetadataObject(metadataObjA: Record<string, unknown>, metadataObjB: Record<string, unknown>): MetadataItemDiffResult {
    const result: MetadataItemDiffResult = {};

    Object.keys(metadataObjA).forEach((key: string) => {
        if (!(key in metadataObjB)) {
            result[key] = {
                oldValue: metadataObjA[key],
                newValue: null
            }
        } else if (!valuesEqual(metadataObjA[key], metadataObjB[key])) {
            result[key] = {
                oldValue: metadataObjA[key],
                newValue: metadataObjB[key]
            }
        }
    });

    Object.keys(metadataObjB).forEach((key: string) => {
        if (!(key in metadataObjA)) {
            result[key] = {
                oldValue: null,
                newValue: metadataObjB[key]
            }
        }
    });

    return result;
}

function getChangeTypeFromChangeObject<T>(changeObject: ChangeObject<T>): ChangeType {
    return changeObject.added ? 'added' : changeObject.removed ? 'removed' : 'unchanged';
}

/**
 * Generates the diff between two CALM architecture instances.
 * @param archA Architecture "before", on which changes are to be made 
 * @param archB Arhcitecture "after" which is changed with respect to architecture A
 * @returns Object representing diffs across different properties of the CALM schema.
 */
export function diffArchitectures(
    archA: CalmArchitectureSchema,
    archB: CalmArchitectureSchema,
): ArchitectureDiffResult {
    const nodesAndRelationshipsDiff = diffNodesAndRelationships(
        archA.nodes ?? [],
        archB.nodes ?? [],
        archA.relationships ?? [],
        archB.relationships ?? [],
    );

    const adrDiff = diffAdrs(archA.adrs ?? [], archB.adrs ?? []);

    const controlsDiff = diffControls(archA.controls ?? {}, archB.controls ?? {});

    const metadataDiff = diffMetadata(archA.metadata ?? {}, archB.metadata ?? {});

    return {
        ...nodesAndRelationshipsDiff,
        ...adrDiff,
        ...controlsDiff,
        ...metadataDiff
    };
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
): NodesAndRelationshipsDiffResult {
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

/**
 * Core diff function for ADR arrays (each ADR is a string, typically a URL). Identifies which ADRs were added, removed or unchanged between two arrays.
 */
export function diffAdrs(
    adrsA: string[] = [],
    adrsB: string[] = [],
): AdrDiffResult {
    return {
        adrDiffItems: diffArrays(adrsA, adrsB).flatMap((diff: ChangeObject<string[]>) => diff.value.map((val: string) => ({
            content: val,
            changeType: getChangeTypeFromChangeObject(diff),
        })))
    };
}

/**
 * Core diff function for CALM control objects. Identifies which controls are added, removed and unchanged by ID, and identifies control changes under an individual ID.
 */
export function diffControls(
    controlsA: CalmControlsSchema,
    controlsB: CalmControlsSchema
): ControlDiffResult {

    const result = {
        controlItemsAdded: {} as CalmControlsSchema,
        controlItemsRemoved: {} as CalmControlsSchema,
        controlItemsUnchanged: {} as CalmControlsSchema,
        controlItemsModified: {} as { [controlId: string]: ControlItemDiffResult }
    };

    const commonControlIds: string[] = [];

    Object.keys(controlsA).forEach((id: string) => {
        if (controlsB[id] != null) {
            commonControlIds.push(id);
        } else {
            result.controlItemsRemoved[id] = controlsA[id];
        }
    });

    Object.keys(controlsB).forEach((id: string) => {
        if (controlsA[id] == null) {
            result.controlItemsAdded[id] = controlsB[id];
        }
    });

    const editedControlIds: string[] = [];

    commonControlIds.forEach((id: string) => {
        if (valuesEqual(controlsA[id], controlsB[id])) {
            result.controlItemsUnchanged[id] = controlsA[id];
        } else {
            editedControlIds.push(id);
        }
    });

    editedControlIds.forEach((id: string) => {
        result.controlItemsModified[id] = diffControlItem(controlsA[id], controlsB[id]);
    });

    return result;
}

/**
 * Core diff function for CALM metadata objects/arrays of objects. For objects, identifies what fields were added, removed or updated. For arrays, identifies what objects were added, removed or unchanged.
 */
export function diffMetadata(metadataA: CalmMetadataSchema, metadataB: CalmMetadataSchema): MetadataDiffResult {

    const result: MetadataDiffResult = {
        metadataObjectsAdded: [],
        metadataObjectsRemoved: [],
        metadataObjectsUnchanged: [],
        metadataObjectsModified: [],
    }

    if (!Array.isArray(metadataA) && !Array.isArray(metadataB)) {
        if (valuesEqual(metadataA, metadataB)) {
            result.metadataObjectsUnchanged.push(metadataA);
        } else {
            result.metadataObjectsModified.push(diffMetadataObject(metadataA, metadataB));
        }
    } else {
        let stringifiedArrayA: string[] = stringifyMetadata(metadataA);
        let stringifiedArrayB: string[] = stringifyMetadata(metadataB);

        const stringifiedDiffItems = diffArrays(stringifiedArrayA, stringifiedArrayB);
        
        for (let i = 0; i < stringifiedDiffItems.length; i++) {
            const diffItem: ChangeObject<string[]> = stringifiedDiffItems[i];
            if (diffItem.added) {
                diffItem.value.forEach((str: string) => result.metadataObjectsAdded.push(JSON.parse(str)));
            } else if (diffItem.removed) {
                diffItem.value.forEach((str: string) => result.metadataObjectsRemoved.push(JSON.parse(str)));
            } else {
                diffItem.value.forEach((str: string) => result.metadataObjectsUnchanged.push(JSON.parse(str)))
            }
        }
    }

    return result;
}
