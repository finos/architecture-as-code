import { initLogger } from '../../../logger';
import { getPatternArray, resolveOperativeChoiceBlock, listSelectableCandidates } from '@finos/calm-models/pattern';

/**
 * A node within a CALM pattern's JSON schema. The pattern is unvalidated JSON
 * that is traversed via deeply nested property chains, so values are typed as
 * `any` to allow that traversal without a cast at every level.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaNode = { [key: string]: any };

export interface CalmChoice {
    description: string,
    nodes: string[],
    relationships: string[]
}

export interface CalmOption {
    optionType: 'oneOf' | 'anyOf',
    optionId: string,
    prompt: string,
    choices: CalmChoice[],
}

function isOptionsRelationship(relationship: SchemaNode): boolean {
    return relationship['properties']?.['relationship-type']?.['properties']?.['options'] !== undefined;
}

function getItemsInOptionsRelationship(optionsRelationship: SchemaNode): SchemaNode[] {
    return optionsRelationship['properties']['relationship-type']['properties']['options']['prefixItems'];
}

function extractOptionsFromBlock(optionsRelationship: SchemaNode, blockType: 'oneOf' | 'anyOf'): CalmOption[] {
    return getItemsInOptionsRelationship(optionsRelationship)
        .filter((prefixItem: SchemaNode) => blockType in prefixItem)
        .map((prefixItem: SchemaNode) => prefixItem[blockType] as SchemaNode[])
        .map((choices: SchemaNode[]) => ({
            optionType: blockType,
            optionId: optionsRelationship['properties']['unique-id']['const'],
            prompt: optionsRelationship['properties']['description']['const'],
            choices: choices.map(choice => ({
                description: choice['properties']['description']['const'],
                nodes: choice['properties']['nodes']['const'],
                relationships: choice['properties']['relationships']['const']
            }))
        }));
}

/**
 * Gets the relationships prefixItems from a pattern, handling allOf structures.
 * @param pattern - The pattern object
 * @returns The prefixItems array from relationships, or empty array if not found
 */
function getRelationshipsPrefixItems(pattern: SchemaNode): SchemaNode[] {
    return getPatternArray(pattern, 'relationships').prefixItems as SchemaNode[];
}

/**
 * Extracts the potential choices that a user can make from a pattern
 * @param pattern - The pattern to extract options from
 * @param debug - Whether to enable debug logging
 * @returns A list of options that the user can choose from
 */
export function extractOptions(pattern: object, debug: boolean = false): CalmOption[] {
    const logger = initLogger(debug, 'calm-generate-options');
    const calmItems: SchemaNode[] = getRelationshipsPrefixItems(pattern as SchemaNode);

    if (calmItems.length === 0) {
        logger.debug('No relationship prefixItems found in pattern');
        return [];
    }

    const options: CalmOption[] = calmItems
        .filter((rel: SchemaNode) => isOptionsRelationship(rel))
        .flatMap((optionsRel: SchemaNode) => [
            ...extractOptionsFromBlock(optionsRel, 'oneOf'),
            ...extractOptionsFromBlock(optionsRel, 'anyOf')
        ]);

    logger.debug(`Found the following options in the pattern: ${options}`);
    return options;
}

type Item = {
    oneOf?: object[],
    anyOf?: object[],
}

/**
 * This function flattens oneOf and anyOf blocks into their constituent items if they match the selection predicate.
 * If the passed item is not a oneOf or anyOf block, it returns the item as is in a list.
 * @param item - The item to flatten
 * @param selectionPredicate - A function that takes an item and returns true if it should be included in the flattened result
 * @returns A list of items that match the selection predicate, or the item itself if it is not a oneOf or anyOf block
 */
function flattenOneOfAndAnyOf(item: Item, selectionPredicate: (item: SchemaNode) => boolean): object[] {
    const block = resolveOperativeChoiceBlock(item);

    if (!block) {
        if (item.oneOf || item.anyOf) {
            // A oneOf/anyOf key is present but isn't a usable choice block (neither value
            // is an array). Passing the item through as-is would emit this malformed
            // block itself as a node/relationship candidate in the generated output -
            // fail loudly instead.
            throw new Error(`Malformed oneOf/anyOf block: neither "oneOf" nor "anyOf" is an array in ${JSON.stringify(item)}`);
        }
        // If it isn't a oneOf or anyOf block, there isn't anything to flatten so return the item
        return [item];
    }

    return (block.alternatives as object[])
        .flatMap((x: object) => x)
        .filter((x: SchemaNode) => selectionPredicate(x));
}

/**
 * Flattens the prefixItems slots (positional "pick exactly one" decisions) and,
 * if present, the `items.oneOf`/`items.anyOf` open catalog (zero-or-more
 * selections) for a given calmType down to the concrete set of chosen entries.
 *
 * The selected catalog candidates are appended onto `prefixItems` so that
 * `instantiate()` - which only understands `prefixItems` - materializes them
 * the same way it already does for the rest of the array. `items` is then
 * cleared, since the pattern's array is now fully expressed via `prefixItems`.
 */
function flattenCalmItems(pattern: SchemaNode, calmType: 'nodes' | 'relationships', ids: string[]): void {
    const calmProps: SchemaNode = pattern['properties']?.[calmType];
    if (!calmProps) return;

    const selectionPredicate = (x: SchemaNode) => ids.includes(x['properties']['unique-id']['const']);

    const prefixItems: SchemaNode[] = calmProps['prefixItems'] ?? [];
    const flattenedPrefixItems = prefixItems
        .flatMap((item: Item) => flattenOneOfAndAnyOf(item, selectionPredicate));

    const itemsCatalog: Item | undefined = calmProps['items'];
    // Only treat `items` as a decision catalog when it is a oneOf/anyOf of candidates. A plain
    // `items` schema (or `items: false` closing a tuple) is not part of the decision mechanism and
    // must be left untouched rather than stripped.
    const catalogBlock = resolveOperativeChoiceBlock(itemsCatalog);
    const isCatalog = catalogBlock !== null;
    const selectedCatalogItems: SchemaNode[] = isCatalog
        ? (catalogBlock!.alternatives as SchemaNode[]).filter(selectionPredicate)
        : [];

    calmProps['prefixItems'] = [...flattenedPrefixItems, ...selectedCatalogItems];

    if (isCatalog) {
        delete calmProps['items'];
    }
}

/**
 * Returns `undefined` when nothing was selected for this decision, rather than the
 * relationship with an empty `options.prefixItems`. An empty `prefixItems` is not a
 * legal JSON Schema, so writing one there breaks the next schema compilation - both
 * `calm generate` and `calm validate` compile the narrowed pattern via `selectChoices`.
 * A decision resolved to "nothing chosen" has nothing to materialize, so the holder
 * itself is dropped instead.
 */
function flattenOptionsRelationship(relationship: SchemaNode, choices: CalmChoice[]): SchemaNode | undefined {
    if (!isOptionsRelationship(relationship)) {
        return relationship;
    }

    const selectionPredicate = (x: SchemaNode) => choices.map(choice => choice.description).includes(x['properties']['description']['const']);
    const newItems = getItemsInOptionsRelationship(relationship)
        .flatMap((item: Item) => flattenOneOfAndAnyOf(item, selectionPredicate));

    if (newItems.length === 0) {
        return undefined;
    }

    relationship['properties']['relationship-type']['properties']['options']['prefixItems'] = newItems;
    return relationship;
}

function flattenOptionsRelationships(pattern: SchemaNode, choices: CalmChoice[]): void {
    // Guard the relationships access the same way `flattenCalmItems` guards its
    // own: a pattern whose nodes are declared entirely through an `items` catalog
    // may carry no `relationships` property at all, and reaching straight through
    // to `prefixItems` would throw on that shape.
    const relationships: SchemaNode | undefined = pattern['properties']?.['relationships'];
    if (!relationships?.['prefixItems']) return;

    relationships['prefixItems'] = relationships['prefixItems']
        .map((rel: SchemaNode) => flattenOptionsRelationship(rel, choices))
        .filter((rel: SchemaNode | undefined): rel is SchemaNode => rel !== undefined);
}

/**
 * Fails when a chosen bundle names a candidate that selection cannot reach.
 *
 * Nothing upstream checks that a bundle's ids resolve. `extractOptions` builds the prompt
 * from the bundle, so the user is offered the choice either way. Selection then finds no
 * match and adds nothing, which discards the answer in silence.
 *
 * Two causes: a typo in the bundle, or a block that declares both `oneOf` and `anyOf`.
 * In the second case the `anyOf` candidates look declared to validation, but only the
 * `oneOf` list is resolved.
 *
 * Called from `runGenerate`, and deliberately not from `selectChoices`. Validation also
 * calls `selectChoices`, and a malformed pattern must show its own schema errors there.
 */
export function assertChoicesAreSelectable(pattern: SchemaNode, choices: CalmChoice[]): void {
    const declaredNodes = new Set(listSelectableCandidates(pattern, 'nodes').map((c) => c.uniqueId));
    const declaredRelationships = new Set(listSelectableCandidates(pattern, 'relationships').map((c) => c.uniqueId));

    const unresolved: string[] = [];
    for (const choice of choices) {
        for (const id of choice.nodes) {
            if (!declaredNodes.has(id)) unresolved.push(`node "${id}" (choice "${choice.description}")`);
        }
        for (const id of choice.relationships) {
            if (!declaredRelationships.has(id)) unresolved.push(`relationship "${id}" (choice "${choice.description}")`);
        }
    }

    if (unresolved.length > 0) {
        throw new Error(
            'The pattern does not declare every candidate its decisions reference, so the ' +
            'selection cannot be applied: ' + unresolved.join('; ') + '. Check the ' +
            'unique-ids in the choice bundles, and that a catalog does not declare both ' +
            '"oneOf" and "anyOf" (only the "oneOf" candidates are selectable).'
        );
    }
}

/**
 * Selects the choices from the pattern and removes all other choices.
 * @param inputPattern - The input pattern to select choices from
 * @param choices - The choices to select
 * @param debug - Whether to enable debug logging
 * @returns A new pattern object with the selected choices and all oneOf and anyOf blocks flattened
 */

export function selectChoices(inputPattern: object, choices: CalmChoice[], debug: boolean = false): object {
    const logger = initLogger(debug, 'calm-generate-options');
    logger.debug(`Selecting these choices from the pattern [${JSON.stringify(choices)}]`);

    const pattern = structuredClone(inputPattern) as SchemaNode; // deep copy so we don't mutate the input pattern, which may be cached and reused by callers
    const nodeIds: string[] = choices.flatMap(choice => choice.nodes);
    const relationshipIds: string[] = choices.flatMap(choice => choice.relationships);

    flattenCalmItems(pattern, 'nodes', nodeIds);
    flattenCalmItems(pattern, 'relationships', relationshipIds);

    flattenOptionsRelationships(pattern, choices);
    
    logger.debug(`Pattern with all non chosen choices removed: [${JSON.stringify(pattern)}]`);
    return pattern;
}