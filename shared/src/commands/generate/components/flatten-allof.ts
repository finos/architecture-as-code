import { SchemaDirectory } from '../../../schema-directory';
import { initLogger, Logger } from '../../../logger';

interface SchemaWithAllOf {
    allOf?: object[];
    $ref?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    type?: string;
    prefixItems?: unknown[];
    [key: string]: unknown;
}

// Which branch of the merge is discarding keys, so the warning can name the right direction.
type DiscardWarning = false | 'allOf-branch' | 'root-override';

const VALUE_SET_KEYWORDS = new Set(['enum', 'type', 'required']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStructural(value: unknown): boolean {
    return Array.isArray(value) || isPlainObject(value);
}

function isEmptyStructural(value: unknown): boolean {
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;
    return false;
}

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        return aKeys.length === bKeys.length && aKeys.every((k) => k in b && deepEqual(a[k], b[k]));
    }
    return false;
}

/**
 * True when `later` is deep-equal to `earlier`, or structurally contains/extends it:
 * every entry of an earlier array is present in the later array (set containment,
 * order-insensitive), or every key of an earlier object is present in the later object
 * with a value that itself contains/extends the earlier one.
 */
function isContainedOrExtended(earlier: unknown, later: unknown): boolean {
    if (deepEqual(earlier, later)) return true;
    if (Array.isArray(earlier)) {
        return Array.isArray(later) && earlier.every((e) => later.some((l) => deepEqual(e, l)));
    }
    if (isPlainObject(earlier)) {
        return (
            isPlainObject(later) &&
            Object.entries(earlier).every(
                ([k, v]) => k in later && isContainedOrExtended(v, later[k])
            )
        );
    }
    return false;
}

/**
 * Names the keys of an earlier property definition that are lost when it is replaced
 * wholesale by a later one (see `deepMergeSchemas`' `properties` branch). A key is
 * discarded when: (1) the later definition omits it; (2) the earlier value is a
 * non-empty object/array that the later value neither equals nor contains/extends; or
 * (3) the earlier value is a scalar and the later value is an object or array. Narrowing
 * a value-set keyword (`enum`, `type`, `required`) and redefining a scalar as a different
 * scalar are legitimate `allOf` refinement, not loss.
 */
function computeDiscardedKeys(
    earlier: Record<string, unknown>,
    later: Record<string, unknown>
): string[] {
    const discarded: string[] = [];

    for (const key of Object.keys(earlier)) {
        const earlierVal = earlier[key];

        if (!(key in later)) {
            discarded.push(key); // rule 1
            continue;
        }

        const laterVal = later[key];

        if (isContainedOrExtended(earlierVal, laterVal)) continue;

        if (VALUE_SET_KEYWORDS.has(key) && Array.isArray(earlierVal) && Array.isArray(laterVal)) {
            const isNarrowing = laterVal.every((l) => earlierVal.some((e) => deepEqual(e, l)));
            if (isNarrowing) continue;
        }

        if (isStructural(earlierVal) && !isEmptyStructural(earlierVal)) {
            discarded.push(key); // rule 2
            continue;
        }

        if (!isStructural(earlierVal) && isStructural(laterVal)) {
            discarded.push(key); // rule 3
        }
        // Remaining case: scalar redefined as a different scalar — legitimate refinement.
    }

    return discarded;
}

function warnOnDiscardedKeys(
    propKey: string,
    earlierVal: unknown,
    laterVal: unknown,
    direction: 'allOf-branch' | 'root-override',
    logger: Logger
): void {
    if (!isPlainObject(earlierVal) || !isPlainObject(laterVal)) return;

    const discardedKeys = computeDiscardedKeys(earlierVal, laterVal);
    if (discardedKeys.length === 0) return;

    const message =
        direction === 'allOf-branch'
            ? `allOf merge on property '${propKey}' discarded keys [${discardedKeys.join(', ')}] declared in an earlier branch. This is a limitation of allOf merging, not an error in the pattern.`
            : `allOf merge on property '${propKey}' discarded keys [${discardedKeys.join(', ')}] declared in an allOf branch and overridden by the schema's own properties.`;

    // Debug, not warn: this is new machinery over a construct the pattern's own
    // documentation already declares unsupported (`allOf` for nodes/relationships), and a
    // false "discarded" report on legitimate refinement is a support question with no
    // action attached. Worth surfacing for someone diagnosing the merge, not worth
    // interrupting everyone else's normal output.
    logger.debug(message);
}

/**
 * Deep merges two schema objects, combining properties, required arrays, and prefixItems.
 *
 * @param warnOnDiscard - When set, logs (via `logger.debug`) about property keys that the
 * `properties` branch's shallow spread discards. `'allOf-branch'` and `'root-override'`
 * select the message's direction; `false` (the default) stays silent, which positional
 * `prefixItems` merges and `$ref`-refinement merges rely on.
 */
function deepMergeSchemas(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
    logger: Logger,
    warnOnDiscard: DiscardWarning = false
): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined) continue;

        if (key === 'properties' && result.properties) {
            const targetProps = result.properties as Record<string, unknown>;
            const sourceProps = value as Record<string, unknown>;

            if (warnOnDiscard) {
                for (const propKey of Object.keys(sourceProps)) {
                    if (!(propKey in targetProps)) continue;
                    warnOnDiscardedKeys(
                        propKey,
                        targetProps[propKey],
                        sourceProps[propKey],
                        warnOnDiscard,
                        logger
                    );
                }
            }

            // Merge properties objects
            result.properties = {
                ...targetProps,
                ...sourceProps,
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
                value as unknown[],
                logger
            );
        } else {
            // Any other key is replaced rather than deep-merged.
            result[key] = value;
        }
    }

    return result;
}

/**
 * Merges two prefixItems arrays by position, combining schemas at each index.
 */
function mergePrefixItems(target: unknown[], source: unknown[], logger: Logger): unknown[] {
    const maxLen = Math.max(target.length, source.length);
    const result: unknown[] = [];

    for (let i = 0; i < maxLen; i++) {
        if (i < target.length && i < source.length) {
            // Both have items at this position - merge them. Positional merges stay silent:
            // the result fuses index i of two branches into a schema neither branch declares
            // on its own, so there is no authored declaration whose lost keys are worth
            // reporting.
            result.push(
                deepMergeSchemas(
                    target[i] as Record<string, unknown>,
                    source[i] as Record<string, unknown>,
                    logger,
                    false
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
        // Merge any additional properties from the original schema. Refining a $ref'd
        // definition with local sibling keys is ordinary JSON Schema composition, so this
        // merge stays silent even when it discards a key.
        const { $ref: _$ref, ...rest } = schema;
        const flattened = await flattenAllOf(resolved as SchemaWithAllOf, schemaDir, debug);
        return deepMergeSchemas(flattened as Record<string, unknown>, rest, logger);
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
            // Merge any additional properties from the $ref schema. Same $ref-refinement
            // case as above — stays silent.
            const { $ref: _$ref, ...rest } = resolved;
            resolved = deepMergeSchemas(
                refResolved as Record<string, unknown>,
                rest,
                logger
            ) as SchemaWithAllOf;
        }

        // Recursively flatten nested allOf
        resolved = (await flattenAllOf(resolved, schemaDir, debug)) as SchemaWithAllOf;

        // Deep merge into accumulated result. Two allOf branches are being merged here, so
        // a key an earlier branch declared and this one discards is worth a warning.
        merged = deepMergeSchemas(merged, resolved, logger, 'allOf-branch');
    }

    // Preserve top-level fields that aren't part of allOf (like $id, $schema, title, etc.).
    // This merges the root schema's own keys OVER the allOf result, so a discarded key here
    // was declared in an allOf branch and lost to the schema's own properties — the
    // opposite direction from the loop above.
    const { allOf: _allOf, ...rest } = schema;
    merged = deepMergeSchemas(merged, rest, logger, 'root-override');

    logger.debug(`Flattened schema has properties: ${Object.keys(merged.properties || {}).join(', ')}`);

    return merged;
}
