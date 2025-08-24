export type CalmControlDetailSchema =
    | {
    'requirement-url': string
    'config-url': string
}
    | {
    'requirement-url': string
    config: Record<string, unknown>
}

export type CalmControlSchema = {
    description: string
    requirements: CalmControlDetailSchema[]
}

export type CalmControlsSchema = {
    [controlId: string]: CalmControlSchema
}
