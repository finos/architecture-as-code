import { initLogger } from '../../../logger';

export interface CalmChoice {
    description: string,
    nodes: string[],
    relationships: string[]
}

export interface CalmOption {
    optionType: 'oneOf' | 'anyOf',
    prompt: string,
    choices: CalmChoice[],
}

function isOptionsRelationship(relationship: object): boolean {
    return relationship['properties']?.['relationship-type']?.['properties']?.['options'] !== undefined;
}

function getItemsInOptionsRelationship(optionsRelationship: object): object[] {
    return optionsRelationship['properties']['relationship-type']['properties']['options']['prefixItems'];
}

function extractOptionsFromBlock(optionsRelationship: object, blockType: 'oneOf' | 'anyOf'): CalmOption[] {
    return getItemsInOptionsRelationship(optionsRelationship)
        .filter((prefixItem: object) => blockType in prefixItem)
        .map((prefixItem: object) => prefixItem[blockType] as object[])
        .map((choices: object[]) => ({
            optionType: blockType,
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
function getRelationshipsPrefixItems(pattern: object): object[] {
    // Direct access for standard patterns
    if (pattern['properties']?.['relationships']?.['prefixItems']) {
        return pattern['properties']['relationships']['prefixItems'];
    }

    // Handle allOf patterns - look for relationships in each allOf schema
    if (pattern['allOf'] && Array.isArray(pattern['allOf'])) {
        for (const schema of pattern['allOf']) {
            if (schema['properties']?.['relationships']?.['prefixItems']) {
                return schema['properties']['relationships']['prefixItems'];
            }
        }
    }

    return [];
}

/**
 * Extracts the potential choices that a user can make from a pattern
 * @param pattern - The pattern to extract options from
 * @param debug - Whether to enable debug logging
 * @returns A list of options that the user can choose from
 */
export function extractOptions(pattern: object, debug: boolean = false): CalmOption[] {
    const logger = initLogger(debug, 'calm-generate-options');
    const calmItems: object[] = getRelationshipsPrefixItems(pattern);

    if (calmItems.length === 0) {
        logger.debug('No relationship prefixItems found in pattern');
        return [];
    }

    const options: CalmOption[] = calmItems
        .filter((rel: object) => isOptionsRelationship(rel))
        .flatMap((optionsRel: object) => [
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
function flattenOneOfAndAnyOf(item: Item, selectionPredicate: (item: object) => boolean): object[] {
    if (!(item.oneOf || item.anyOf)) {
        // If it isn't a oneOf or anyOf block, there isn't anything to flatten so return the item
        return [item];
    }

    const items: object[] = item.oneOf || item.anyOf;

    return items
        .flatMap((x: object) => x)
        .filter((x: object) => selectionPredicate(x));
}

function flattenCalmItems(pattern: object, calmType: 'nodes' | 'relationships', ids: string[]): void {
    const calmItems = pattern['properties'][calmType]['prefixItems'];

    const selectionPredicate = (x: object) => ids.includes(x['properties']['unique-id']['const']);
    pattern['properties'][calmType]['prefixItems'] = calmItems
        .flatMap((item: object) => flattenOneOfAndAnyOf(item, selectionPredicate));
}

function flattenOptionsRelationship(relationship: object, choices: CalmChoice[]): object {
    if (!isOptionsRelationship(relationship)) {
        return relationship;
    }

    const selectionPredicate = (x: object) => choices.map(choice => choice.description).includes(x['properties']['description']['const']);
    const newItems = getItemsInOptionsRelationship(relationship)
        .flatMap((item: object) => flattenOneOfAndAnyOf(item, selectionPredicate));

    relationship['properties']['relationship-type']['properties']['options']['prefixItems'] = newItems;
    return relationship;
}

function flattenOptionsRelationships(pattern: object, choices: CalmChoice[]): void {
    pattern['properties']['relationships']['prefixItems'] = pattern['properties']['relationships']['prefixItems']
        .map((rel: object) => flattenOptionsRelationship(rel, choices));
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

    const pattern = {...inputPattern}; // make a copy so we don't mutate the input pattern
    const nodeIds: string[] = choices.flatMap(choice => choice.nodes);
    const relationshipIds: string[] = choices.flatMap(choice => choice.relationships);

    flattenCalmItems(pattern, 'nodes', nodeIds);
    flattenCalmItems(pattern, 'relationships', relationshipIds);

    flattenOptionsRelationships(pattern, choices);
    
    logger.debug(`Pattern with all non chosen choices removed: [${JSON.stringify(pattern)}]`);
    return pattern;
}