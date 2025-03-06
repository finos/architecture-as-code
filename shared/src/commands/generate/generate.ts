import * as fs from 'node:fs';
import * as path from 'node:path';
import {mkdirp} from 'mkdirp';

import * as winston from 'winston';
import {initLogger} from '../../logger.js';
import {CALMArchitecture} from '../../types.js';
import {SchemaDirectory} from '../../schema-directory.js';
import {instantiateNodes} from './components/node.js';
import {instantiateRelationships} from './components/relationship.js';
import {CALM_META_SCHEMA_DIRECTORY} from '../../consts.js';
import {instantiateAllMetadata} from './components/metadata.js';

let logger: winston.Logger; // defined later at startup

function loadFile(path: string): object {
    try {
        logger.info('Loading pattern from file: ' + path);
        const raw = fs.readFileSync(path, 'utf-8');

        logger.debug('Attempting to load pattern file: ' + raw);
        const pattern = JSON.parse(raw);

        logger.debug('Loaded pattern file.');
        return pattern;
    } catch (err) {
        if (err.code === 'ENOENT') {
            logger.error('Pattern not found!');
        } else {
            logger.error(err);
        }
        process.exit(1);
    }
}

export interface CalmChoice {
    description: string,
    nodes: string[],
    relationships: string[]
}

export interface CalmOption {
    choices: CalmChoice[],
}

export async function optionsFor(patternPath: string,  debug: boolean): Promise<CalmOption[]> {
    logger = initLogger(debug);
    const pattern = loadFile(patternPath);

    const options: CalmChoice[] = [];
    pattern['properties']['relationships']['prefixItems'].forEach((relationship: object) => {
        if ('properties' in relationship && 'options' in relationship['properties']['relationship-type']) {
            relationship['properties']['relationship-type']['options']['prefixItems'].forEach((prefixItem: object) => {
                if ('oneOf' in prefixItem) {
                    (prefixItem['oneOf'] as Array<object>).forEach((option: object) => {
                        options.push({
                            description: option['properties']['description']['const'],
                            nodes: option['properties']['nodes']['const'],
                            relationships: option['properties']['relationships']['const']
                        });
                    });
                }
            });
        }
    });

    return [{choices: options}];
}

export function selectOption(patternPath: string, debug: boolean, option: CalmOption): object {
    logger = initLogger(debug);
    const pattern = loadFile(patternPath);

    pattern['properties']['nodes']['prefixItems'].forEach((node: object) => {
        // if its a oneOf node, loop through it and find only the ones in the given option
        // remove the original oneof node
        // add in the selected nodes to the prefixItems list
        // at the end, there should be no oneOf blocks left
        if ('oneOf' in node) {
            (node['oneOf'] as Array<object>).forEach((oneOfNode: object) => {
                option.choices.forEach((choice: CalmChoice) => {
                    if (choice.nodes.find(chosenNode => chosenNode === oneOfNode['properties']['unique-id']['const'])) {
                        pattern['properties']['nodes']['prefixItems'].push(oneOfNode);
                    }
                });
            });

            pattern['properties']['nodes']['prefixItems'].splice(pattern['properties']['nodes']['prefixItems'].indexOf(node), 1);
        }
    });

    pattern['properties']['relationships']['prefixItems'].forEach((relationship: object) => {
        if ('oneOf' in relationship) {
            (relationship['oneOf'] as Array<object>).forEach((oneOfRelationship: object) => {
                option.choices.forEach((choice: CalmChoice) => {
                    if (choice.relationships.find(chosenRelationship => chosenRelationship === oneOfRelationship['properties']['unique-id']['const'])) {
                        pattern['properties']['relationships']['prefixItems'].push(oneOfRelationship);
                    }
                });
            });

            pattern['properties']['relationships']['prefixItems'].splice(pattern['properties']['relationships']['prefixItems'].indexOf(relationship), 1);
        }
    });

    return pattern;
}

export async function generate(pattern: object, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<CALMArchitecture> {
    logger = initLogger(debug);
    const schemaDirectory = new SchemaDirectory(debug);

    try {

        await schemaDirectory.loadSchemas(CALM_META_SCHEMA_DIRECTORY);
        if (schemaDirectoryPath) {
            await schemaDirectory.loadSchemas(schemaDirectoryPath);
        }
    }
    catch (err) {
        logger.error('Error while trying to load schemas: ' + err.message);
        throw err;
    }

    // const pattern = loadFile(patternPath);
    schemaDirectory.loadCurrentPatternAsSchema(pattern);

    const outputNodes = instantiateNodes(pattern, schemaDirectory, debug, instantiateAll);
    const relationshipNodes = instantiateRelationships(pattern, schemaDirectory, debug, instantiateAll);
    const metadata = instantiateAllMetadata(pattern, schemaDirectory, debug, instantiateAll);

    const patternSchemaId = pattern['$id'];

    const final = {
        'nodes': outputNodes,
        'relationships': relationshipNodes
    };

    if (metadata) {
        final['metadata'] = metadata;
    }

    if (patternSchemaId) {
        final['$schema'] = patternSchemaId;
    }

    return final;
}

export async function runGenerate(pattern: object, outputPath: string, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<void> {
    try {
        const final = await generate(pattern, debug, instantiateAll, schemaDirectoryPath);
        const output = JSON.stringify(final, null, 2);
        const dirname = path.dirname(outputPath);

        logger.debug('Writing output to ' + outputPath);

        mkdirp.sync(dirname);
        fs.writeFileSync(outputPath, output);
    }
    catch (err) {
        logger.error('Error while generating architecture from pattern: ' + err.message);
        if (debug) {
            logger.error(err.stack);
        }
    }
}
