export type CalmDecoratorTargetTypeSchema = 'architecture';

export type CalmDecoratorSchema = {
    $schema?: string;
    'unique-id': string;
    type: string;
    'target-type'?: CalmDecoratorTargetTypeSchema[];
    target: string[];
    'applies-to': string[];
    data: Record<string, unknown>;
};
