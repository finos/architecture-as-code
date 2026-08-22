/**
 * Read-only reader for where candidate nodes and relationships live in a CALM pattern's
 * JSON Schema, and how a `oneOf`/`anyOf` choice block should be read.
 *
 * A CALM pattern declares candidates in four places: a plain `prefixItems` entry, a
 * `prefixItems[i].oneOf`/`anyOf` alternative, or an `items.oneOf`/`items.anyOf` open
 * catalog member. This module is the single place that knows how to find them, so
 * generation, validation and the visualiser stop hand-rolling the same traversal.
 *
 * Two different questions get two different functions, deliberately kept apart:
 * `readChoiceBlock` picks the single form a decision offers (`oneOf` wins over `anyOf`);
 * `listCandidates` unions both, because validation needs every id a pattern declares.
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
 * TEMPORARY. Replicates today's first-`allOf`-branch-wins reading of `prefixItems`/`items`
 * for a top-level pattern property. A later branch that declares the same path is ignored.
 *
 * It exists because candidate discovery runs on the raw pattern, before `flattenAllOf`.
 * The `allOf` merge rework will delete this function. Do not correct the precedence here.
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

export interface ChoiceBlock {
    groupType: 'oneOf' | 'anyOf';
    alternatives: SchemaNode[];
}

/**
 * The alternatives that one choice block offers, for a `prefixItems` slot or an `items`
 * catalog. `oneOf` wins when both are present. Returns `null` when neither keyword is
 * an array.
 *
 * This picks one answer. A caller that needs every declared id must use `listCandidates`.
 */
export function readChoiceBlock(items: SchemaNode | undefined): ChoiceBlock | null {
    if (!items) return null;

    const hasOneOf = Array.isArray(items['oneOf']);
    const hasAnyOf = Array.isArray(items['anyOf']);
    if (!hasOneOf && !hasAnyOf) return null;

    return {
        groupType: hasOneOf ? 'oneOf' : 'anyOf',
        alternatives: (hasOneOf ? items['oneOf'] : items['anyOf']) as SchemaNode[],
    };
}

function readUniqueId(node: SchemaNode): string | undefined {
    const properties = node['properties'];
    if (!isObject(properties)) return undefined;
    const uniqueIdSchema = properties['unique-id'];
    if (!isObject(uniqueIdSchema)) return undefined;
    const constValue = uniqueIdSchema['const'];
    return typeof constValue === 'string' ? constValue : undefined;
}

export type Candidate = {
    uniqueId: string;
    site: 'prefixItem' | 'prefixItemAlternative' | 'catalogMember';
    node: SchemaNode;
    path: (string | number)[];
    slotIndex?: number;
    blockType?: 'oneOf' | 'anyOf';
};

/**
 * Every node/relationship candidate declared under `properties.<calmType>`, across all
 * four declaration sites.
 *
 * Unions `oneOf` and `anyOf`, which is the opposite of `readChoiceBlock`. Validation
 * needs every declared id. Do not route this through `readChoiceBlock` - that drops
 * every `anyOf` candidate when `oneOf` is also present.
 *
 * Skips a candidate with no `const`-pinned `unique-id`. A pure choice-block slot has no
 * id of its own, and counting it would create a false diagnostic.
 *
 * Reads the direct path only. It does not fall back into `allOf`, because
 * `getPatternArray` discards which branch it read, so `path` could not be trusted.
 */
export function listCandidates(pattern: SchemaNode, calmType: 'nodes' | 'relationships'): Candidate[] {
    const candidates: Candidate[] = [];
    const properties = pattern['properties'];
    const field = isObject(properties) ? properties[calmType] : undefined;
    if (!isObject(field)) return candidates;

    const prefixItems = Array.isArray(field['prefixItems']) ? (field['prefixItems'] as SchemaNode[]) : [];

    prefixItems.forEach((item, i) => {
        if (!isObject(item)) return;

        const uniqueId = readUniqueId(item);
        if (uniqueId) {
            candidates.push({
                uniqueId,
                site: 'prefixItem',
                node: item,
                path: ['properties', calmType, 'prefixItems', i],
            });
        }

        (['oneOf', 'anyOf'] as const).forEach((blockType) => {
            const alternatives = item[blockType];
            if (!Array.isArray(alternatives)) return;
            alternatives.forEach((alt, j) => {
                if (!isObject(alt)) return;
                const altUniqueId = readUniqueId(alt);
                if (!altUniqueId) return;
                candidates.push({
                    uniqueId: altUniqueId,
                    site: 'prefixItemAlternative',
                    node: alt,
                    path: ['properties', calmType, 'prefixItems', i, blockType, j],
                    slotIndex: i,
                    blockType,
                });
            });
        });
    });

    const itemsCatalog = field['items'];
    if (isObject(itemsCatalog)) {
        (['oneOf', 'anyOf'] as const).forEach((blockType) => {
            const alternatives = itemsCatalog[blockType];
            if (!Array.isArray(alternatives)) return;
            alternatives.forEach((alt, j) => {
                if (!isObject(alt)) return;
                const altUniqueId = readUniqueId(alt);
                if (!altUniqueId) return;
                candidates.push({
                    uniqueId: altUniqueId,
                    site: 'catalogMember',
                    node: alt,
                    path: ['properties', calmType, 'items', blockType, j],
                    blockType,
                });
            });
        });
    }

    return candidates;
}
