import type {
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../types/index.js';

export interface NodeChange {
    original: CalmNodeSchema;
    updated: CalmNodeSchema;
}

export interface RelationshipChange {
    original: CalmRelationshipSchema;
    updated: CalmRelationshipSchema;
}

export interface RenameMapping {
    oldId: string;
    newId: string;
    node: CalmNodeSchema;
}

export interface RelationshipRenameMapping {
    oldId: string;
    newId: string;
    relationship: CalmRelationshipSchema;
}

/**
 * Items that were skipped because they lacked a `unique-id`.
 * Surfaced so consumers can flag invalid input rather than silently
 * dropping it from the diff (which would otherwise produce a false
 * "no changes" result).
 */
export interface InvalidDiffItems {
    nodes: unknown[];
    relationships: unknown[];
}

/**
 * Pattern items that are legitimate but cannot be diffed: they declare a
 * node/relationship without pinning anything comparable (e.g. an unconstrained
 * `unique-id`, or a bare `$ref`). Unlike {@link InvalidDiffItems} these are not
 * invalid input — a pattern needn't pin every id — but there's no content to
 * match on, so they're surfaced (and counted toward `hasChanges`) rather than
 * silently dropped.
 */
export interface UndiffableDiffItems {
    nodes: unknown[];
    relationships: unknown[];
}

export interface DiffResult {
    nodesAdded: CalmNodeSchema[];
    nodesRemoved: CalmNodeSchema[];
    nodesModified: NodeChange[];
    nodesSame: CalmNodeSchema[];
    nodesRenamed: RenameMapping[];

    edgesAdded: CalmRelationshipSchema[];
    edgesRemoved: CalmRelationshipSchema[];
    edgesModified: RelationshipChange[];
    edgesSame: CalmRelationshipSchema[];
    edgesRenamed: RelationshipRenameMapping[];

    invalidItems?: InvalidDiffItems;
    undiffableItems?: UndiffableDiffItems;
}
