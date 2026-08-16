/**
 * Read-only reader for where candidate nodes and relationships live in a CALM pattern's
 * JSON Schema.
 *
 * A CALM pattern declares candidates in four places: a plain `prefixItems` entry, a
 * `prefixItems[i].oneOf`/`anyOf` alternative, or an `items.oneOf`/`items.anyOf` open
 * catalog member. This module is the single place that knows how to find them, so
 * generation, validation and the visualiser stop hand-rolling the same traversal.
 *
 * No selection, no mutation, no rendering — only reading. The surface is deliberately
 * limited to what has a caller today; add functions when a consumer needs them, so their
 * shape is validated by real use rather than guessed.
 */

export type SchemaNode = Record<string, unknown>;

function isObject(value: unknown): value is SchemaNode {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}


/**
 * TEMPORARY — replicates today's lossy first-`allOf`-branch-wins reading of an array
 * keyword (`prefixItems`/`items`) for a top-level pattern property (`nodes`/
 * `relationships`): reads `properties.<key>.<keyword>` directly, and otherwise returns
 * the first `allOf` branch that declares it. A later branch declaring the same path is
 * silently ignored — this exists only because decision/candidate discovery currently
 * runs on the raw pattern, before `flattenAllOf` runs. The real fix belongs with the
 * `allOf` merge rework (see the tracked follow-up issue), which will delete this
 * function rather than correct it. Do not "fix" the precedence here — see the reader's
 * `allOf` handling notes in the implementation plan this module was built from.
 */
function readArrayKeyword(pattern: SchemaNode, key: string, keyword: string): unknown {
    const direct = pattern['properties'];
    if (isObject(direct)) {
        const field = direct[key];
        if (isObject(field) && field[keyword]) {
            return field[keyword];
        }
    }

    if (Array.isArray(pattern['allOf'])) {
        for (const branch of pattern['allOf']) {
            if (!isObject(branch)) continue;
            const branchProperties = branch['properties'];
            if (!isObject(branchProperties)) continue;
            const field = branchProperties[key];
            if (isObject(field) && field[keyword]) {
                return field[keyword];
            }
        }
    }

    return undefined;
}

export interface PatternArray {
    prefixItems: SchemaNode[];
    catalog: SchemaNode | undefined;
}

/**
 * Reads the `prefixItems` array and `items` open-catalog declared for a top-level
 * pattern property (`nodes` or `relationships`), resolving `allOf` per `readArrayKeyword`
 * above. Absent `prefixItems` yields an empty array so callers can iterate
 * unconditionally; an absent catalog yields `undefined`.
 */
export function getPatternArray(pattern: SchemaNode, calmType: 'nodes' | 'relationships'): PatternArray {
    const prefixItems = readArrayKeyword(pattern, calmType, 'prefixItems');
    const catalog = readArrayKeyword(pattern, calmType, 'items');
    return {
        prefixItems: Array.isArray(prefixItems) ? (prefixItems as SchemaNode[]) : [],
        catalog: isObject(catalog) ? catalog : undefined,
    };
}

export interface Catalog {
    groupType: 'oneOf' | 'anyOf';
    alternatives: SchemaNode[];
}

/**
 * Reads an `items` open-catalog's decision alternatives. `oneOf` wins over `anyOf`
 * when both are present; either keyword being a non-array leaves the catalog
 * untreated. Returns `null` when `items` is absent or neither keyword is an array.
 */
export function readCatalog(items: SchemaNode | undefined): Catalog | null {
    if (!items) return null;

    const hasOneOf = Array.isArray(items['oneOf']);
    const hasAnyOf = Array.isArray(items['anyOf']);
    if (!hasOneOf && !hasAnyOf) return null;

    return {
        groupType: hasOneOf ? 'oneOf' : 'anyOf',
        alternatives: (hasOneOf ? items['oneOf'] : items['anyOf']) as SchemaNode[],
    };
}
