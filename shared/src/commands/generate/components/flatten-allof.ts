import { SchemaDirectory } from '../../../schema-directory';
import { initLogger } from '../../../logger';

interface SchemaWithAllOf {
    allOf?: object[];
    $ref?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    type?: string;
    prefixItems?: unknown[];
    [key: string]: unknown;
}

/**
 * Deep merges two schema objects, combining properties, required arrays, and prefixItems.
 */
function deepMergeSchemas(
    target: Record<string, unknown>,
    source: Record<string, unknown>
): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) continue;

        if (key === 'properties' && result.properties) {
            // Merge properties objects
            result.properties = {
                ...(result.properties as Record<string, unknown>),
                ...(value as Record<string, unknown>),
            };
        } else if (key === 'required' && result.required) {
            // Combine required arrays, removing duplicates
            result.required = [
                ...new Set([...(result.required as string[]), ...(value as string[])]),
            ];
        } else if (key === 'prefixItems' && result.prefixItems) {
            // Merge prefixItems by position
            result.prefixItems = mergePrefixItems(
                result.prefixItems as unknown[],
                value as unknown[]
            );
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Merges two prefixItems arrays by position, combining schemas at each index.
 */
function mergePrefixItems(target: unknown[], source: unknown[]): unknown[] {
    const maxLen = Math.max(target.length, source.length);
    const result: unknown[] = [];

    for (let i = 0; i < maxLen; i++) {
        if (i < target.length && i < source.length) {
            // Both have items at this position - merge them
            result.push(
                deepMergeSchemas(
                    target[i] as Record<string, unknown>,
                    source[i] as Record<string, unknown>
                )
            );
        } else if (i < target.length) {
            result.push(target[i]);
        } else {
            result.push(source[i]);
        }
    }

    return result;
}

/**
 * Recursively flattens allOf schemas into a single merged schema.
 * Resolves $ref references using the schema directory.
 *
 * @param schema - The schema to flatten
 * @param schemaDir - The schema directory for resolving $ref references
 * @param debug - Enable debug logging
 * @returns A flattened schema with all allOf compositions merged
 */
export async function flattenAllOf(
    schema: SchemaWithAllOf,
    schemaDir: SchemaDirectory,
    debug: boolean = false
): Promise<object> {
    const logger = initLogger(debug, 'flatten-allof');

    // If schema has a $ref at root level (without allOf), resolve it
    if (schema.$ref && !schema.allOf) {
        logger.debug(`Resolving root $ref: ${schema.$ref}`);
        const resolved = await schemaDir.getDefinition(schema.$ref);
        // Merge any additional properties from the original schema
        const { $ref: _$ref, ...rest } = schema;
        const flattened = await flattenAllOf(resolved as SchemaWithAllOf, schemaDir, debug);
        return deepMergeSchemas(flattened as Record<string, unknown>, rest);
    }

    // If no allOf, return schema as-is
    if (!schema.allOf) {
        return schema;
    }

    logger.debug(`Flattening allOf with ${schema.allOf.length} schemas`);

    // Start with an empty merged schema
    let merged: Record<string, unknown> = {};

    // Process each schema in the allOf array
    for (const subSchema of schema.allOf) {
        let resolved = subSchema as SchemaWithAllOf;

        // Resolve $ref if present
        if (resolved.$ref) {
            logger.debug(`Resolving $ref in allOf: ${resolved.$ref}`);
            const refResolved = await schemaDir.getDefinition(resolved.$ref);
            // Merge any additional properties from the $ref schema
            const { $ref: _$ref, ...rest } = resolved;
            resolved = deepMergeSchemas(
                refResolved as Record<string, unknown>,
                rest
            ) as SchemaWithAllOf;
        }

        // Recursively flatten nested allOf
        resolved = (await flattenAllOf(resolved, schemaDir, debug)) as SchemaWithAllOf;

        // Deep merge into accumulated result
        merged = deepMergeSchemas(merged, resolved);
    }

    // Preserve top-level fields that aren't part of allOf (like $id, $schema, title, etc.)
    const { allOf: _allOf, ...rest } = schema;
    merged = deepMergeSchemas(merged, rest);

    logger.debug(`Flattened schema has properties: ${Object.keys(merged.properties || {}).join(', ')}`);

    return merged;
}
