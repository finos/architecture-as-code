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
    return 'properties' in relationship && 'properties' in relationship['properties']['relationship-type'] && 'options' in relationship['properties']['relationship-type']['properties'];
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

export function extractOptions(pattern: object, debug: boolean = false): CalmOption[] {
    const logger = initLogger(debug, 'calm-generate-options');
    const calmItems: object[] = pattern['properties']['relationships']['prefixItems'];

    const options: CalmOption[] = calmItems
        .filter((rel: object) => isOptionsRelationship(rel))
        .flatMap((optionsRel: object) => [
            ...extractOptionsFromBlock(optionsRel, 'oneOf'),
            ...extractOptionsFromBlock(optionsRel, 'anyOf')
        ]);

    logger.debug(`Found the following options in the pattern: ${options}`);
    return options;
}

// This function mutates the pattern in place to add all of the items which were selected to 
// the correct section in the pattern, deleting the rest of the oneOf or anyOf block in the process.
function flattenCalmItems(pattern: object, calmType: 'nodes' | 'relationships', ids: string[], debug: boolean = false): void {
    const logger = initLogger(debug, 'calm-generate-options');
    logger.debug('Selecting ids [%O] in [%s]', ids, calmType);
    const calmItems = pattern['properties'][calmType]['prefixItems'];

    calmItems
        .filter((item: object) => 'oneOf' in item || 'anyOf' in item)
        .flatMap((item: object) => item['oneOf'] || item['anyOf'])
        .forEach((item: object) => {
            ids.forEach((id: string) => {
                const itemUniqueId = item['properties']['unique-id']['const'];
                if (id === itemUniqueId) {
                    logger.debug(`Adding [${itemUniqueId}] to [${calmType}]`);
                    calmItems.push(item);
                }
            });
        });

    logger.debug(`Removing "oneOf" and "anyOf" blocks from ${calmType}`);
    calmItems
        .filter((item: object) => 'oneOf' in item || 'anyOf' in item)
        .forEach((item: object) => calmItems.splice(calmItems.indexOf(item), 1));
}

export function selectChoices(pattern: object, choices: CalmChoice[], debug: boolean = false): object {
    const logger = initLogger(debug, 'calm-generate-options');
    const nodeIds: string[] = choices.flatMap(choice => choice.nodes);
    const relationshipIds: string[] = choices.flatMap(choice => choice.relationships);

    flattenCalmItems(pattern, 'nodes', nodeIds);
    flattenCalmItems(pattern, 'relationships', relationshipIds);

    pattern['properties']['relationships']['prefixItems']
        .filter(((item: object) => 'properties' in item['properties']['relationship-type'] && 'options' in item['properties']['relationship-type']['properties']))
        .map((item: object) => item['properties']['relationship-type']['properties']['options'])
        .forEach((optionRel: object) => {
            const optionsItems = optionRel['prefixItems'];
            optionsItems
                .filter((item: object) => 'oneOf' in item || 'anyOf' in item)
                .flatMap((item: object) => item['oneOf'] || item['anyOf'])
                .forEach((item: object) => {
                    const itemDescription: string = item['properties']['description']['const'];
                    if (choices.map(choice => choice.description).includes(itemDescription)) {
                        logger.debug(`Adding [${itemDescription}] to options`);
                        optionsItems.push(item);
                    }
                });
            logger.debug('Removing "oneOf" and "anyOf" blocks from options');
            optionsItems
                .filter((item: object) => 'oneOf' in item || 'anyOf' in item)
                .forEach((item: object) => optionsItems.splice(optionsItems.indexOf(item), 1));
        });

    
    logger.debug(`Pattern with all non chosen choices removed: [${JSON.stringify(pattern)}]`);

    return pattern;
}