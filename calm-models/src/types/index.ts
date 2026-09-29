// Export all type definitions
export * from './core-types.js';
export * from './control-types.js';
export * from './flow-types.js';
export * from './interface-types.js';
export * from './metadata-types.js';
export * from './adr-types.js';
export * from './control-requirement-types.js';
export * from './units-types.js';
export * from './timeline-types.js';

export const CALM_DOCUMENT_TYPES_LIST = [
    'pattern',
    'architecture',
    'interface',
    'flow',
    'control',
    'schema',
    'timeline',
    'adr'
] as const;

export type CalmDocumentType = (typeof CALM_DOCUMENT_TYPES_LIST)[number];

export const CALM_NARRATIVE_DOCUMENT_TYPES_LIST = ['knowledge', 'sad'] as const;

export type NarrativeDocumentType = (typeof CALM_NARRATIVE_DOCUMENT_TYPES_LIST)[number];

export function isNarrativeDocumentType(input: unknown): input is NarrativeDocumentType {
    return typeof input === 'string' && CALM_NARRATIVE_DOCUMENT_TYPES_LIST.includes(input as NarrativeDocumentType);
}

export function isValidCalmDocumentType(input: string): input is CalmDocumentType {
    return CALM_DOCUMENT_TYPES_LIST.some((type) => type === input);
}

// Export relationship type classes
export {
    CalmComposedOfType,
    CalmConnectsType,
    CalmDeployedInType,
    CalmInteractsType,
    CalmOptionsRelationshipType,
    CalmDecisionType
} from '../model/relationship.js';
