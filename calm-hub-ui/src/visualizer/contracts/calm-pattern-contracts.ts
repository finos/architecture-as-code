/*
    These types capture the structure of CALM Pattern JSON Schemas. They may not be perfect as
    I based them of examples in the codebase, please advise on how I can improve the types.
*/


export type PrefixItem = {
    type: string,
    properties: any,
}

type PatternProperties<T = PrefixItem> = {
    type: string,
    minItems?: number,
    maxItems?: number,
    prefixItems: T[],
};

export type NodePrefixItem = {
    type: string,
    properties: {
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
        controls?: PrefixItem,
    }
};

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
    'deployed-in'?: any,
    'composed-of'?: any,
    options?: any,
}

export type RelationshipPrefixItem = {
    type: string,
    properties: {
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
}

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