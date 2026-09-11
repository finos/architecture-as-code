export interface ControlDetail {
    id: number;
    name: string;
    description: string;
    title?: string;
}

export interface ControlConfigDetail {
    id: number;
    name?: string;
    title?: string;
}

export interface ControlData {
    domain: string;
    controlId: number;
    controlName: string;
    controlDescription: string;
    controlTitle?: string;
}

/**
 * A single property entry in a JSON-Schema-flavour requirement document. Loose
 * on purpose — only the keys the readable viewer inspects are named.
 */
export type JsonSchemaProperty = {
    type?: string | string[];
    format?: string;
    title?: string;
    description?: string;
    enum?: unknown[];
    const?: unknown;
    default?: unknown;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
    items?: JsonSchemaProperty;
} & Record<string, unknown>;

/**
 * A control requirement document as returned by the Hub. Comes in two real-world
 * flavours the viewer must handle without knowing which in advance: a JSON Schema
 * (`properties` / `required`) or a prose document (`summary` / `requirements[]` /
 * `references[]`). All keys optional.
 */
export interface ControlRequirementDoc extends Record<string, unknown> {
    $schema?: string;
    $id?: string;
    id?: string;
    title?: string;
    name?: string;
    description?: string;
    summary?: string;
    type?: string;
    category?: string;
    source?: string;
    url?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
    requirements?: string[];
    contributing_factors?: string[];
    references?: string[];
}

/** A control configuration document — a flat instance of a requirement schema. */
export interface ControlConfigurationDoc extends Record<string, unknown> {
    'control-id'?: string;
    name?: string;
    description?: string;
}

export type ControlDoc = ControlRequirementDoc | ControlConfigurationDoc;
