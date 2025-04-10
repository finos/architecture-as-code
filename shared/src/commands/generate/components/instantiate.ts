import { initLogger } from '../../../logger';
import { SchemaDirectory } from '../../../schema-directory';
import { getPropertyValue, JsonSchema } from './property';

interface PatternDefinition {
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    type?: string;
    prefixItems?: JsonSchema[];
}

interface PatternDocument {
    $schema?: string;
    properties: Record<string, PatternDefinition>;
}

function resolveSchema(def: JsonSchema, schemaDir: SchemaDirectory): JsonSchema {
    if (!def?.$ref) return def;

    const resolved = schemaDir.getDefinition(def.$ref) as JsonSchema;
    const requiredFromSchema = resolved.required ?? [];
    const patternProps = def.properties ?? {};
    const patternRequired = def.required ?? [];
    const schemaProps = resolved.properties ?? {};

    const mergedProps: Record<string, JsonSchema> = { ...patternProps };

    for (const key of patternRequired) {
        if (!(key in mergedProps) && key in schemaProps) {
            mergedProps[key] = schemaProps[key];
        }
    }

    for (const key of requiredFromSchema) {
        if (!(key in mergedProps) && key in schemaProps) {
            mergedProps[key] = schemaProps[key];
        }
    }

    return {
        ...resolved,
        ...def,
        properties: mergedProps,
        required: [...new Set([...(def.required ?? []), ...requiredFromSchema])]
    };
}

function instantiateObject(
    def: JsonSchema,
    schemaDir: SchemaDirectory,
    path: string[]
): Record<string, unknown> {
    const resolved = resolveSchema(def, schemaDir);
    const out: Record<string, unknown> = {};

    for (const [key, valueDefRaw] of Object.entries(resolved.properties ?? {})) {
        const valueDef = resolveSchema(valueDefRaw, schemaDir);

        if (valueDef.const !== undefined) {
            out[key] = valueDef.const;
        } else if (valueDef.type === 'object') {
            out[key] = instantiateObject(valueDef, schemaDir, [...path, key]);
        } else if (valueDef.type === 'array' && valueDef.prefixItems) {
            out[key] = valueDef.prefixItems.map((itemDef, idx) => {
                const resolvedItem = resolveSchema(itemDef, schemaDir);
                return instantiateObject(resolvedItem, schemaDir, [...path, key, `${idx}`]);
            });
        } else {
            out[key] = getPropertyValue(key, valueDef);
        }
    }

    if (resolved.patternProperties && def.properties) {
        for (const [pattern, schema] of Object.entries(resolved.patternProperties)) {
            const regex = new RegExp(pattern);

            for (const key of Object.keys(def.properties)) {
                if (regex.test(key)) {
                    const patternValue = def.properties[key] ?? {};
                    const merged = resolveSchema({ ...schema, ...patternValue }, schemaDir);
                    const val = instantiateObject(merged, schemaDir, [...path, key]);
                    out[key] = val;
                }
            }
        }
    }

    return out;
}

function instantiateFromProperties(
    pattern: PatternDocument,
    schemaDir: SchemaDirectory
): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    const properties = pattern.properties ?? {};

    for (const [key, def] of Object.entries(properties)) {
        const resolvedDef = resolveSchema(def as JsonSchema, schemaDir);

        if (resolvedDef.type === 'array' && resolvedDef.prefixItems) {
            output[key] = resolvedDef.prefixItems.map((itemDef, idx) => {
                const resolvedItem = resolveSchema(itemDef, schemaDir);
                return instantiateObject(resolvedItem, schemaDir, [key, `${idx}`]);
            });
        } else {
            output[key] = instantiateObject(resolvedDef, schemaDir, [key]);
        }
    }

    return output;
}





/**
 * Loads a pattern JSON document, resolves its referenced schemas,
 * and instantiates an architecture document based on required and defined fields.
 *
 * The method:
 * - Loads the pattern file from the given path.
 * - Loads and registers schemas from the given directory (if provided).
 * - Resolves `$ref` references in the pattern using the schema directory.
 * - Merges defined fields in the pattern with required fields in the pattern and from the referenced schemas.
 * - Generates placeholder values for fields that are required but not defined in the pattern.
 * - Handles nested structures and arrays using recursive traversal.
 * - Supports `patternProperties` for dynamic keys (e.g. `controls.security`, etc).
 *
 * @param patternPath - Path to the `.pattern.json` file to instantiate.
 * @param debug - Enables debug logging for detailed output during instantiation.
 * @param schemaDirectoryPath - Optional path to the directory containing schemas to resolve `$ref` values.
 * @returns A Promise resolving to the fully instantiated architecture document.
 */
export async function instantiate(
    patternObj: object,
    debug: boolean,
    schemaDirectoryPath?: string
): Promise<unknown> {
    // I could cast this to CALMCoreSchema here but then need to change test to not show its completely generic
    initLogger(debug, 'calm-generate');
    const schemaDir = new SchemaDirectory(debug);

    if (schemaDirectoryPath) {
        await schemaDir.loadSchemas(schemaDirectoryPath);
    }

    const pattern = patternObj as PatternDocument;
    schemaDir.loadCurrentPatternAsSchema(pattern);

    const output = instantiateFromProperties(pattern, schemaDir);

    if (pattern.$schema) {
        output.$schema = pattern.$schema;
    }

    return output;
}
