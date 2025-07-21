export type CalmInterfaceDefinitionSchema = {
    'unique-id': string;
    'definition-url': string;
    config: Record<string, unknown>;
}

export type CalmInterfaceTypeSchema = {
    'unique-id': string,
    [key: string]: unknown;
}

export type CalmNodeInterfaceSchema = {
    node: string;
    interfaces?: string[];
}

