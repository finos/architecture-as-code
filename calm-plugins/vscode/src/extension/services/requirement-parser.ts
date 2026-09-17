// Shared, pure parser for CALM control-requirement JSON Schemas. Used by local
// scanning, picker attachment, standards resolution, and webview enrichment so
// there is a single source of truth for how a requirement maps to editable
// properties. No VS Code or Node APIs — safe to run in any context.

export interface RequirementIdentity {
    controlId: string;
    name: string;
    description: string;
}

export type RequirementPropertyType =
    | 'string'
    | 'boolean'
    | 'number'
    | 'integer'
    | 'enum';

export interface RequirementPropertyDef {
    type: RequirementPropertyType;
    /** Native enum values — strings, numbers, or booleans (never coerced). */
    allowedValues?: Array<string | number | boolean>;
    pattern?: string;
    /** Help text for the input; NOT an example value. */
    description?: string;
    required: boolean;
}

export interface ParsedRequirement {
    identity: RequirementIdentity;
    properties: Record<string, RequirementPropertyDef>;
}

export interface ParseResult {
    parsed: ParsedRequirement | null;
    warnings: string[];
}

/** Base fields that carry identity, not user-editable config, plus schema keywords. */
const BASE_FIELDS = new Set([
    'control-id',
    'name',
    'description',
    '$schema',
    '$id',
    'title',
    'type',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readConst(props: Record<string, unknown>, key: string): string | null {
    const def = props[key];
    if (!isRecord(def)) return null;
    const c = def.const;
    return typeof c === 'string' && c.length > 0 ? c : null;
}

/**
 * Resolve a `$ref` that points at a local `defs` / `$defs` entry. Returns the
 * referenced schema object, or `null` for external or unresolvable refs.
 */
function resolveLocalRef(
    ref: string,
    root: Record<string, unknown>
): Record<string, unknown> | null {
    const m = /^#\/(\$?defs)\/(.+)$/.exec(ref);
    if (!m) return null;
    const bag = root[m[1]];
    if (!isRecord(bag)) return null;
    const target = bag[m[2]];
    return isRecord(target) ? target : null;
}

/**
 * Interpret a single property schema into a `RequirementPropertyDef`.
 * Returns `null` for unsupported shapes (object, array, external `$ref`).
 */
function interpretProperty(
    schema: Record<string, unknown>,
    required: boolean,
    root: Record<string, unknown>
): RequirementPropertyDef | null {
    // Inline-resolve a local $ref before applying the type rules.
    if (typeof schema.$ref === 'string') {
        const resolved = resolveLocalRef(schema.$ref, root);
        if (!resolved) return null;
        schema = { ...resolved, ...schema };
        delete (schema as Record<string, unknown>).$ref;
    }

    const description =
        typeof schema.description === 'string' ? schema.description : undefined;

    if (Array.isArray(schema.enum)) {
        const allowed = schema.enum.filter(
            (v): v is string | number | boolean =>
                typeof v === 'string' ||
                typeof v === 'number' ||
                typeof v === 'boolean'
        );
        return { type: 'enum', allowedValues: allowed, description, required };
    }

    const type = schema.type;
    if (type === 'boolean') return { type: 'boolean', description, required };
    if (type === 'integer') return { type: 'integer', description, required };
    if (type === 'number') return { type: 'number', description, required };
    if (type === 'string' || type === undefined) {
        const def: RequirementPropertyDef = { type: 'string', description, required };
        if (typeof schema.pattern === 'string') def.pattern = schema.pattern;
        return def;
    }

    // object, array, or anything else → unsupported
    return null;
}

/**
 * Parse a control-requirement JSON Schema into identity constants plus a map of
 * editable property definitions. Returns `{ parsed: null, warnings }` when the
 * schema is malformed or is missing any identity constant.
 */
export function parseRequirementSchema(
    schema: unknown,
    fallbackIdentity?: RequirementIdentity
): ParseResult {
    const warnings: string[] = [];
    if (!isRecord(schema)) {
        return { parsed: null, warnings: ['Requirement schema is not an object'] };
    }

    const props = schema.properties;
    if (!isRecord(props)) {
        return {
            parsed: null,
            warnings: ['Requirement schema has no properties object'],
        };
    }

    const controlId = readConst(props, 'control-id');
    const name = readConst(props, 'name');
    const description = readConst(props, 'description');
    let identity: RequirementIdentity;
    if (controlId && name && description) {
        identity = { controlId, name, description };
    } else if (fallbackIdentity) {
        identity = {
            controlId: controlId ?? fallbackIdentity.controlId,
            name: name ?? fallbackIdentity.name,
            description: description ?? fallbackIdentity.description,
        };
        warnings.push('Identity constants partially derived from control metadata');
    } else {
        return {
            parsed: null,
            warnings: [
                'Requirement is missing one or more identity constants (control-id, name, description)',
            ],
        };
    }

    const requiredArr = Array.isArray(schema.required)
        ? (schema.required as unknown[]).filter(
              (v): v is string => typeof v === 'string'
          )
        : [];
    const requiredSet = new Set(requiredArr);

    const properties: Record<string, RequirementPropertyDef> = {};
    for (const [key, rawDef] of Object.entries(props)) {
        if (BASE_FIELDS.has(key)) continue;
        const isRequired = requiredSet.has(key);
        if (!isRecord(rawDef)) {
            warnings.push(
                `Skipped ${isRequired ? 'required ' : ''}property "${key}": not a schema object`
            );
            continue;
        }
        const def = interpretProperty(rawDef, isRequired, schema);
        if (!def) {
            warnings.push(
                `Skipped ${isRequired ? 'required ' : ''}property "${key}": unsupported type (object, array, or external $ref)`
            );
            continue;
        }
        properties[key] = def;
    }

    return {
        parsed: { identity, properties },
        warnings,
    };
}

/** True when any parser warning flags an unsupported *required* property (blocks valid config). */
export function hasUnsupportedRequiredProperty(warnings: string[]): boolean {
    return warnings.some((w) => w.startsWith('Skipped required property'));
}
