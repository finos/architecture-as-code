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
}
