export type CalmCoreCanonicalModel = {
    nodes: CalmNodeCanonicalModel[];
    relationships: CalmRelationshipCanonicalModel[];
    metadata: CalmMetadataCanonicalModel;
    controls: CalmControlsCanonicalModel;
    flows: CalmFlowCanonicalModel[];
    adrs: string[];
};

export type CalmNodeCanonicalModel = {
    'unique-id': string;
    'node-type': string;
    name: string;
    description: string;
    details?: CalmCoreCanonicalModel;
    interfaces?: CalmInterfaceCanonicalModel[];
    controls?: CalmControlsCanonicalModel;
    metadata?: CalmMetadataCanonicalModel;
} & Record<string, unknown>; // includes any additional properties

export type CalmDecisionCanonicalModel = {
    description: string;
    nodes: string[];
    relationships: string[];
    controls?: string[];
    metadata?: string[];
};

export type CalmRelationshipTypeCanonicalModel =
    | { interacts: { actor: string; nodes: string[] } }
    | { connects: { source: CalmNodeInterfaceCanonicalModel; destination: CalmNodeInterfaceCanonicalModel } }
    | { 'deployed-in': { container: string; nodes: string[] } }
    | { 'composed-of': { container: string; nodes: string[] } }
    | { options: CalmDecisionCanonicalModel[] };

export type CalmRelationshipCanonicalModel = {
    'unique-id': string;
    'relationship-type': CalmRelationshipTypeCanonicalModel;
    description?: string;
    protocol?: string;
    metadata: CalmMetadataCanonicalModel;
    controls: CalmControlsCanonicalModel;
} & Record<string, unknown>;

export type CalmFlowCanonicalModel = {
    'unique-id': string;
    name: string;
    description: string;
    transitions: CalmFlowTransitionCanonicalModel[];
    'requirement-url': string;
    controls: CalmControlsCanonicalModel;
    metadata: CalmMetadataCanonicalModel;
};

export type CalmFlowTransitionCanonicalModel = {
    'relationship-unique-id': string;
    'sequence-number': number;
    description: string;
    direction?: 'source-to-destination' | 'destination-to-source';
};

export type CalmMetadataCanonicalModel = Record<string, unknown>;

export type CalmControlsCanonicalModel = {
    [controlId: string]: CalmControlCanonicalModel;
};

export type CalmControlCanonicalModel = {
    description: string;
    requirements: CalmControlDetailCanonicalModel[];
};

export type CalmControlDetailCanonicalModel = {
    'requirement-url': string;
} & Record<string, unknown>;

export type CalmNodeInterfaceCanonicalModel = {
    node: string;
    interfaces?: string[];
};

export type CalmInterfaceCanonicalModel = {
    'unique-id': string;
} & Record<string, unknown>; // includes flattened config or other props

