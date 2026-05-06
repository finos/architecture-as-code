import type { CalmNode, CalmRelationship, CalmNodeSchema, CalmRelationshipSchema, CalmArchitectureSchema } from '@finos/calm-models/types';

/**
 * Represents a change to a node (property modifications)
 */
export interface NodeChange {
    original: CalmNode;
    updated: CalmNode;
}

/**
 * Represents a change to a relationship (property modifications)
 */
export interface RelationshipChange {
    original: CalmRelationship;
    updated: CalmRelationship;
}

/**
 * Represents a renamed node
 */
export interface RenameMapping {
    oldId: string;
    newId: string;
    node: CalmNode;
}

/**
 * Represents a renamed relationship
 */
export interface RelationshipRenameMapping {
    oldId: string;
    newId: string;
    relationship: CalmRelationship;
}

/**
 * Complete diff result between two architectures
 */
export interface DiffResult {
    // Nodes
    nodesAdded: CalmNode[];
    nodesRemoved: CalmNode[];
    nodesModified: NodeChange[];
    nodesSame: CalmNode[];
    nodesRenamed: RenameMapping[];

    // Relationships/Edges
    edgesAdded: CalmRelationship[];
    edgesRemoved: CalmRelationship[];
    edgesModified: RelationshipChange[];
    edgesSame: CalmRelationship[];
    edgesRenamed: RelationshipRenameMapping[];
}

/**
 * Node diff status for visualization
 */
export type NodeDiffStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'same' | undefined;

/**
 * Edge/Relationship diff status for visualization
 */
export type EdgeDiffStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'same' | undefined;

/**
 * Metadata attached to nodes during diff visualization
 */
export interface DiffNodeMetadata {
    diffStatus: NodeDiffStatus;
    renamedFrom?: string; // Only set if status === 'renamed'
}

/**
 * Metadata attached to edges during diff visualization
 */
export interface DiffEdgeMetadata {
    diffStatus: EdgeDiffStatus;
    renamedFrom?: string; // Only set if status === 'renamed'
}

/**
 * Extended node data with diff status
 */
export interface DiffNodeData extends CalmNodeSchema {
    diffStatus?: 'added' | 'removed' | 'modified' | 'renamed' | 'unchanged';
    originalId?: string; // For renamed nodes
}

/**
 * Extended edge data with diff status
 */
export interface DiffEdgeData extends CalmRelationshipSchema {
    diffStatus?: 'added' | 'removed' | 'modified' | 'renamed' | 'unchanged';
    originalId?: string; // For renamed edges
}

/**
 * Props for the DiffGraph component
 */
export interface DiffGraphProps {
    architecture: CalmArchitectureSchema;
    diffResult: DiffResult | null;
    isFirst: boolean;
}

/**
 * Props for the DiffPanel component
 */
export interface DiffSectionProps<T> {
    title: string;
    items: T[];
    renderItem: (item: T) => string;
    className: string;
}

/**
 * Props for the DiffGraphPanel component
 */
export interface DiffGraphPanelProps {
    archA: CalmArchitectureSchema | null;
    archB: CalmArchitectureSchema | null;
    diffResult: DiffResult | null;
    onFileLoad: (file: File, isFirst: boolean) => void;
}

/**
 * Props for the DiffPanel component
 */
export interface DiffPanelProps {
    diffResult: DiffResult | null;
}
