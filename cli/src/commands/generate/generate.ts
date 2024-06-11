import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import * as winston from 'winston';
import { initLogger } from '../helper.js';
import { CALMInstantiation } from '../../types.js';
import { SchemaDirectory } from './schema-directory.js';
import { instantiateNode, instantiateNodes } from './components/node.js';
import { instantiateRelationships } from './components/relationship.js';
import { CALM_META_SCHEMA_DIRECTORY } from '../../consts.js';
import { instantiateAllMetadata } from './components/metadata.js';

let logger: winston.Logger; // defined later at startup

function loadFile(path: string): object {
    logger.info('Loading pattern from file: ' + path);
    const raw = fs.readFileSync(path, 'utf-8');

    logger.debug('Attempting to load pattern file: ' + raw);
    const pattern = JSON.parse(raw);

    logger.debug('Loaded pattern file.');
    return pattern;
}


function instantiateAdditionalTopLevelProperties(pattern: object, schemaDirectory: SchemaDirectory): object {
    if (!('properties' in pattern)) {
        logger.error('Warning: pattern has no properties defined.');
        return [];
    }
    const properties = pattern['properties'];

    const extraProperties = {};
    for (const [additionalProperty, detail] of Object.entries(properties)) {
        // additional properties only
        if (['nodes', 'relationships'].includes(additionalProperty)) {
            continue;
        }

        // TODO handle generic top level properties, not just nodes
        extraProperties[additionalProperty] = instantiateNode(detail, schemaDirectory);
    }

    return extraProperties;
}

export const exportedForTesting = {
    instantiateAdditionalTopLevelProperties
};

export async function generate(patternPath: string, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<CALMInstantiation> {
    logger = initLogger(debug);
    const schemaDirectory = new SchemaDirectory(debug);

    await schemaDirectory.loadSchemas(CALM_META_SCHEMA_DIRECTORY);
    if (schemaDirectoryPath) {
        await schemaDirectory.loadSchemas(schemaDirectoryPath);
    }

    const pattern = loadFile(patternPath);
    schemaDirectory.loadCurrentPatternAsSchema(pattern);

    const outputNodes = instantiateNodes(pattern, schemaDirectory, debug, instantiateAll);
    const relationshipNodes = instantiateRelationships(pattern, schemaDirectory, debug, instantiateAll);
    const additionalProperties = instantiateAdditionalTopLevelProperties(pattern, schemaDirectory);
    const metadata = instantiateAllMetadata(pattern, schemaDirectory, debug, instantiateAll);

    const final = {
        'nodes': outputNodes,
        'relationships': relationshipNodes,
        ...additionalProperties // object spread operator to insert additional props at top level
    };

    if (metadata) {
        final['metadata'] = metadata;
    }

    return final;
}

export async function runGenerate(patternPath: string, outputPath: string, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<void> {
    const final = await generate(patternPath, debug, instantiateAll, schemaDirectoryPath);

    const output = JSON.stringify(final, null, 2);
    logger.debug('Generated instantiation: ' + output);

    const dirname = path.dirname(outputPath);

    logger.debug('Writing output to ' + outputPath);

    mkdirp.sync(dirname);
    fs.writeFileSync(outputPath, output);
}
