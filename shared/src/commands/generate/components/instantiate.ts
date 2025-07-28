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
    $id?: string;
    $schema?: string;
    properties: Record<string, PatternDefinition>;
}

async function resolveSchema(def: JsonSchema, schemaDir: SchemaDirectory): Promise<JsonSchema> {
    if (!def?.$ref) return def;

    const resolved = await schemaDir.getDefinition(def.$ref) as JsonSchema;
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

async function instantiateObject(
    def: JsonSchema,
    schemaDir: SchemaDirectory,
    path: string[]
): Promise<Record<string, unknown>> {
    const resolved = await resolveSchema(def, schemaDir);
    const out: Record<string, unknown> = {};

    for (const [key, valueDefRaw] of Object.entries(resolved.properties ?? {})) {
        const valueDef = await resolveSchema(valueDefRaw, schemaDir);

        if (valueDef.const !== undefined) {
            out[key] = valueDef.const;
        } else if (valueDef.type === 'object') {
            out[key] = await instantiateObject(valueDef, schemaDir, [...path, key]);
        } else if (valueDef.type === 'array' && valueDef.prefixItems) {
            out[key] = await Promise.all(valueDef.prefixItems.map(async (itemDef, idx) => {
                const resolvedItem = await resolveSchema(itemDef, schemaDir);
                return await instantiateObject(resolvedItem, schemaDir, [...path, key, `${idx}`]);
            }));
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
                    const merged = await resolveSchema({ ...schema, ...patternValue }, schemaDir);
                    const val = await instantiateObject(merged, schemaDir, [...path, key]);
                    out[key] = val;
                }
            }
        }
    }

    return out;
}

async function instantiateFromProperties(
    pattern: PatternDocument,
    schemaDir: SchemaDirectory
): Promise<Record<string, unknown>> {
    const output: Record<string, unknown> = {};
    const properties = pattern.properties ?? {};

    for (const [key, def] of Object.entries(properties)) {
        const resolvedDef = await resolveSchema(def as JsonSchema, schemaDir);

        if (resolvedDef.type === 'array' && resolvedDef.prefixItems) {
            output[key] = await Promise.all(
                resolvedDef.prefixItems.map(async (itemDef, idx) => {
                    const resolvedItem = await resolveSchema(itemDef, schemaDir);
                    if (resolvedItem.const !== undefined) {
                        return resolvedItem.const;
                    }
                    return await instantiateObject(resolvedItem, schemaDir, [key, `${idx}`]);
                })
            );
        } else {
            output[key] = await instantiateObject(resolvedDef, schemaDir, [key]);
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
    schemaDirectory: SchemaDirectory
): Promise<unknown> {
    // I could cast this to CALMCoreSchema here but then need to change test to not show its completely generic
    initLogger(debug, 'calm-generate');

    await schemaDirectory.loadSchemas();

    const pattern = patternObj as PatternDocument;
    schemaDirectory.loadCurrentPatternAsSchema(pattern);

    const output = await instantiateFromProperties(pattern, schemaDirectory);

    if (pattern.$id) {
        // $schema on an architecture identifies the pattern ID in use.
        output.$schema = pattern.$id;
    }

    return output;
}
