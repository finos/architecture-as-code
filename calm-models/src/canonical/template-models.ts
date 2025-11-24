export type CalmCoreCanonicalModel = {
    nodes: CalmNodeCanonicalModel[];
    relationships: CalmRelationshipCanonicalModel[];
    metadata?: CalmMetadataCanonicalModel;
    controls?: CalmControlsCanonicalModel;
    flows?: CalmFlowCanonicalModel[];
    adrs?: string[];
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
} & Record<string, unknown>;

export type CalmTimelineCanonicalModel = {
    'current-moment'?: string;
    moments: CalmMomentCanonicalModel[];
    metadata?: CalmMetadataCanonicalModel;
}

export type CalmMomentCanonicalModel =
    CalmNodeCanonicalModel & {
        'valid-from'?: string;
        adrs?: string[];
}

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
    metadata?: CalmMetadataCanonicalModel;
    controls?: CalmControlsCanonicalModel;
} & Record<string, unknown>;

export type CalmFlowCanonicalModel = {
    'unique-id': string;
    name: string;
    description: string;
    transitions: CalmFlowTransitionCanonicalModel[];
    'requirement-url': string;
    controls?: CalmControlsCanonicalModel;
    metadata?: CalmMetadataCanonicalModel;
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
} & Record<string, unknown>;

export type CalmRelationshipKey = 'interacts' | 'connects' | 'composed-of' | 'deployed-in' | 'options';

export type ExtractRel<K extends CalmRelationshipKey> =
    Extract<CalmRelationshipTypeCanonicalModel, Record<K, unknown>>;

export function isInteracts(rel: CalmRelationshipTypeCanonicalModel): rel is ExtractRel<'interacts'> {
    return 'interacts' in rel;
}

export function isConnects(rel: CalmRelationshipTypeCanonicalModel): rel is ExtractRel<'connects'> {
    return 'connects' in rel;
}

export function isComposedOf(rel: CalmRelationshipTypeCanonicalModel): rel is ExtractRel<'composed-of'> {
    return 'composed-of' in rel;
}

export function isDeployedIn(rel: CalmRelationshipTypeCanonicalModel): rel is ExtractRel<'deployed-in'> {
    return 'deployed-in' in rel;
}

export function isOptions(rel: CalmRelationshipTypeCanonicalModel): rel is ExtractRel<'options'> {
    return 'options' in rel;
}

export function visitRelationship<T>(
    rel: CalmRelationshipTypeCanonicalModel,
    fns: {
        interacts?: (r: ExtractRel<'interacts'>) => T;
        connects?: (r: ExtractRel<'connects'>) => T;
        composedOf?: (r: ExtractRel<'composed-of'>) => T;
        deployedIn?: (r: ExtractRel<'deployed-in'>) => T;
        options?: (r: ExtractRel<'options'>) => T;
        default: () => T;
    }
): T {
    if (isInteracts(rel) && fns.interacts) return fns.interacts(rel);
    if (isConnects(rel) && fns.connects) return fns.connects(rel);
    if (isComposedOf(rel) && fns.composedOf) return fns.composedOf(rel);
    if (isDeployedIn(rel) && fns.deployedIn) return fns.deployedIn(rel);
    if (isOptions(rel) && fns.options) return fns.options(rel);
    return fns.default();
}


export type CalmRelationshipTypeKindView =
    | { kind: 'interacts'; actor: string; nodes: string[] }
    | { kind: 'connects'; source: CalmNodeInterfaceCanonicalModel; destination: CalmNodeInterfaceCanonicalModel }
    | { kind: 'deployed-in'; container: string; nodes: string[] }
    | { kind: 'composed-of'; container: string; nodes: string[] }
    | { kind: 'options'; options: CalmDecisionCanonicalModel[] };

export function toKindView(rel: CalmRelationshipTypeCanonicalModel): CalmRelationshipTypeKindView {
    return visitRelationship<CalmRelationshipTypeKindView>(rel, {
        interacts:  r => ({ kind: 'interacts',   actor: r.interacts.actor, nodes: r.interacts.nodes }),
        connects:   r => ({ kind: 'connects',    source: r.connects.source, destination: r.connects.destination }),
        deployedIn: r => ({ kind: 'deployed-in', container: r['deployed-in'].container, nodes: r['deployed-in'].nodes }),
        composedOf: r => ({ kind: 'composed-of', container: r['composed-of'].container, nodes: r['composed-of'].nodes }),
        options:    r => ({ kind: 'options',     options: r.options }),
        default:    () => { throw new Error('Unknown relationship type'); },
    });
}