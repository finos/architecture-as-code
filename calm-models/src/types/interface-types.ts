export type CalmInterfaceDefinitionSchema = {
    'unique-id': string;
    'definition-url': string;
    config: Record<string, unknown>;
}

export type CalmInterfaceTypeSchema = {
    'unique-id': string,
    [key: string]: unknown;
}

// Used by relationships. The interfaces property refers to unique-id(s) of
// CalmInterfaceTypeSchema or CalmInterfaceDefinitionSchema
export type CalmNodeInterfaceSchema = {
    node: string;
    interfaces?: string[];
}

