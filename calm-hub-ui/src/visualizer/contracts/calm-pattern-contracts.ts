export type IndividualPrefixItem<P extends Record<string, unknown> = Record<string, unknown>> = {
    type: string;
    properties: P;
};

type AnyOfPrefixItem<T extends Record<string, unknown> = Record<string, unknown>> = {
    anyOf: IndividualPrefixItem<T>[];
}

type OneOfPrefixItem<T extends Record<string, unknown> = Record<string, unknown>> = {
    oneOf: IndividualPrefixItem<T>[];
};

export type PrefixItem<T extends Record<string, unknown> = Record<string, unknown>> = IndividualPrefixItem<T> | AnyOfPrefixItem<T> | OneOfPrefixItem<T>;

type PatternProperties<T = PrefixItem> = {
    type: string,
    minItems?: number,
    maxItems?: number,
    prefixItems: T[],
};

export type NodeProperties = {
    "unique-id": {
        const: string
    },
    name: {
        const: string
    },
    description: {
        const: string
    },
    "node-type": {
        const: string
    },
    interfaces?: PatternProperties,
    controls?: IndividualPrefixItem,
}

export type NodePrefixItem = PrefixItem<NodeProperties>;

type RelationshipTypeDescription = {
    connects?: {
        source: {
            node: string,
        },
        destination: {
            node: string
        }
    },
    interacts?: {
        actor: string,
        nodes: string[]
    },
    'deployed-in'?: {
        container: string,
        nodes: string[]
    },
    'composed-of'?: {
        container: string,
        nodes: string[]
    },
}

export type RelationshipProperties = {
    "unique-id": {
        const: string
    },
    description: {
        const: string
    },
    protocol?: {
        const: string
    },
    'relationship-type': {
        const: RelationshipTypeDescription,
    },
    controls?: PrefixItem,
}

export type RelationshipPrefixItem = PrefixItem<RelationshipProperties>;

export type CalmPatternSchema = {
    type: string,
    title: string,
    description?: string,
    properties: {
        nodes: PatternProperties<NodePrefixItem>,
        relationships: PatternProperties<RelationshipPrefixItem>,
        metadata?: PatternProperties,
        controls?: PatternProperties,
        flows?: PatternProperties,
        adrs?: PatternProperties,
    }
    required: string[],
}