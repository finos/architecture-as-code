// Pure builder for standalone CALM control-requirement JSON Schema documents.
// Extracted from ControlCreator so the authoring logic is unit-testable without
// rendering React.

export type ControlPropertyType =
    | 'string'
    | 'boolean'
    | 'number'
    | 'integer'
    | 'enum';

export interface ControlPropertyInput {
    name: string;
    type: ControlPropertyType;
    required: boolean;
    /** For `enum` — the allowed string values. */
    enumValues?: string[];
    /** For `string` — an optional regex pattern. */
    pattern?: string;
    description?: string;
}

export interface ControlRequirementInput {
    /** Lowercase-kebab Hub slug — also the file stem. */
    slug: string;
    /** Hub domain the control belongs to (e.g. "platform", "api", "security"). */
    domain: string;
    /** Human display name → schema `title`. */
    name: string;
    description: string;
    properties: ControlPropertyInput[];
}

export interface BuiltControlRequirement {
    json: string;
    fileName: string;
    $id: string;
}

/** Property names that collide with base identity fields or schema keywords. */
export const RESERVED_PROPERTY_NAMES = new Set([
    'control-id',
    'name',
    'description',
    '$schema',
    '$id',
    'title',
    'type',
    'allOf',
    'required',
    '$defs',
    'defs',
]);

const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const CONTROL_REQUIREMENT_REF =
    'https://calm.finos.org/release/1.2/meta/control-requirement.json';

/** Inline enums up to this many values; larger enums are emitted via `$defs`. */
const INLINE_ENUM_LIMIT = 3;

export function isReservedPropertyName(name: string): boolean {
    return RESERVED_PROPERTY_NAMES.has(name);
}

/** Convert a display name to a lowercase-kebab slug candidate. */
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Validate authoring input. Returns a list of human-readable errors (empty = valid). */
export function validateControlRequirementInput(
    input: ControlRequirementInput
): string[] {
    const errors: string[] = [];
    if (!SLUG_RE.test(input.slug)) {
        errors.push('Slug must be lowercase kebab-case (e.g. micro-segmentation)');
    }
    if (!input.domain.trim()) {
        errors.push('Domain is required');
    } else if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(input.domain)) {
        errors.push('Domain must be lowercase kebab-case (e.g. platform, api)');
    }
    if (!input.name.trim()) errors.push('Display name is required');
    if (!input.description.trim()) errors.push('Description is required');

    const seen = new Set<string>();
    for (const prop of input.properties) {
        const name = prop.name.trim();
        if (!name) {
            errors.push('Property names cannot be empty');
            continue;
        }
        if (isReservedPropertyName(name)) {
            errors.push(`Property name "${name}" is reserved`);
        }
        if (/[/~]/.test(name)) {
            errors.push(`Property name "${name}" contains invalid characters`);
        }
        if (seen.has(name)) errors.push(`Duplicate property name "${name}"`);
        seen.add(name);

        if (prop.type === 'enum') {
            // Trim and drop empty segments — trailing commas are normal mid-typing.
            const vals = (prop.enumValues ?? []).map((v) => v.trim()).filter(Boolean);
            if (vals.length === 0) {
                errors.push(`Enum property "${name}" needs at least one value`);
            }
            if (new Set(vals).size !== vals.length) {
                errors.push(`Enum property "${name}" has duplicate values`);
            }
        }

        if (prop.type === 'string' && prop.pattern) {
            try {
                new RegExp(prop.pattern);
            } catch {
                errors.push(`Property "${name}" has an invalid regex pattern`);
            }
        }
    }
    return errors;
}

/**
 * Build the JSON Schema control-requirement document plus its target file name.
 * Generates Hub-compatible format with CURIE `$id` and top-level metadata.
 * Assumes the input is valid (see {@link validateControlRequirementInput}).
 */
export function buildControlRequirement(
    input: ControlRequirementInput
): BuiltControlRequirement {
    const $id = `${input.domain}:controls:${input.slug}`;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const $defs: Record<string, unknown> = {};

    for (const prop of input.properties) {
        const name = prop.name.trim();
        properties[name] = buildPropertySchema(prop, name, $defs);
        if (prop.required) required.push(name);
    }

    const doc: Record<string, unknown> = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id,
        title: input.name,
        description: input.description,
        type: 'object',
        properties,
    };
    if (required.length > 0) doc.required = required;
    if (Object.keys($defs).length > 0) doc.$defs = $defs;

    return {
        json: JSON.stringify(doc, null, 2),
        fileName: `${input.slug}.requirement.json`,
        $id,
    };
}

function buildPropertySchema(
    prop: ControlPropertyInput,
    name: string,
    $defs: Record<string, unknown>
): Record<string, unknown> {
    const withDescription = (schema: Record<string, unknown>) => {
        if (prop.description?.trim()) schema.description = prop.description.trim();
        return schema;
    };

    if (prop.type === 'enum') {
        const values = (prop.enumValues ?? []).map((v) => v.trim()).filter(Boolean);
        if (values.length > INLINE_ENUM_LIMIT) {
            $defs[name] = withDescription({ enum: values });
            return { $ref: `#/$defs/${name}` };
        }
        return withDescription({ enum: values });
    }
    if (prop.type === 'boolean') return withDescription({ type: 'boolean' });
    if (prop.type === 'integer') return withDescription({ type: 'integer' });
    if (prop.type === 'number') return withDescription({ type: 'number' });
    // string
    const schema: Record<string, unknown> = { type: 'string' };
    if (prop.pattern) schema.pattern = prop.pattern;
    return withDescription(schema);
}
