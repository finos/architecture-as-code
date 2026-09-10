// Lab addition (not in the Hub original): the Hub types this pipeline against
// `@finos/calm-models/types`, whose schemas promise required fields. The lab
// parses the live editor buffer, so nothing is promised — every field here is
// optional, and the runtime guards in the parsers (not these types) are the
// safety net. Values that flow into ReactFlow ids keep the schema's `string`
// so the ported logic type-checks unchanged; a mid-edit document that breaks
// that promise is caught by parseCALMData's try/catch.

export interface LabCalmNode {
    'unique-id'?: string;
    'node-type'?: unknown;
    name?: unknown;
    [key: string]: unknown;
}

export interface LabContainment {
    container?: string;
    nodes?: string[];
}

export interface LabRelationshipType {
    connects?: { source?: { node?: string }; destination?: { node?: string } };
    interacts?: { actor?: string; nodes?: string[] };
    'deployed-in'?: LabContainment;
    'composed-of'?: LabContainment;
    options?: unknown;
    [key: string]: unknown;
}

export interface LabCalmRelationship {
    'unique-id'?: string;
    'relationship-type'?: LabRelationshipType;
    description?: unknown;
    protocol?: unknown;
    [key: string]: unknown;
}

export interface LabFlowTransition {
    'relationship-unique-id'?: string;
    direction?: string;
    'sequence-number'?: number;
    description?: string;
}

export interface LabCalmFlow {
    name?: string;
    transitions?: LabFlowTransition[];
    [key: string]: unknown;
}

export interface LabCalmDoc {
    nodes?: LabCalmNode[];
    relationships?: LabCalmRelationship[];
    flows?: LabCalmFlow[];
    [key: string]: unknown;
}
