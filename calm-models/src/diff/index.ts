export {
    diffArchitectures,
    diffNodesAndRelationships,
    nodeStructureMatches,
    relationshipStructureMatches,
} from './diff.js';
export {
    diffPatterns,
    normalisePatternToInstance,
} from './pattern-diff.js';
export type {
    DiffResult,
    NodeChange,
    RelationshipChange,
    RenameMapping,
    RelationshipRenameMapping,
    InvalidDiffItems,
} from './diff-types.js';
