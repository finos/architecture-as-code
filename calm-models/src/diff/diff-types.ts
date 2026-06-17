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
 * `unique-id` that is present but not pinned with a `const`, so there's nothing
 * concrete to match on. Unlike {@link InvalidDiffItems} these are not invalid
 * input — a pattern needn't pin every id — but with no content to match they're
 * surfaced (and counted toward `hasChanges`) rather than silently dropped.
 * Items that declare no `unique-id` at all (bare `$ref`s, decision wrappers) are
 * skipped entirely and never reported here.
 */
export interface UndiffableDiffItems {
    nodes: unknown[];
    relationships: unknown[];
}

interface AdrDiffItem {
    content: string;
    changeType: 'added' | 'removed' | 'unchanged';
}

export interface NodesAndRelationshipsDiffResult {
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

/**
 * Represents the result of diffing two lists of ADRs, including which ADRs were added, removed, or unchanged.
 */
export interface AdrDiffResult {
    adrDiffItems: AdrDiffItem[];
}

/**
 * Represents the result of diffing two CALM architecture instances: includes nodes, relationships and ADRs. TODO: incorporate controls, flows and metadata.
 */
export type ArchitectureDiffResult = NodesAndRelationshipsDiffResult & AdrDiffResult;
