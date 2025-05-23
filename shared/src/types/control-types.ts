export type CalmControlDetailSchema = {
    'control-requirement-url': string;
    'control-config-url': string;
}
    | {
    'control-requirement-url': string;
    'control-config': Record<string, unknown>;
};

export type CalmControlSchema = {
    description: string;
    requirements: CalmControlDetailSchema[];
};

export type CalmControlsSchema = {
    [controlId: string]: CalmControlSchema;
};
