/* eslint-disable  @typescript-eslint/no-explicit-any */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdirp } from 'mkdirp';

import * as winston from 'winston';
import { initLogger } from '../helper.js';
import { CALMInstantiation } from '../../types.js';
import { SchemaDirectory } from './schema-directory.js';
import { instantiateNode, instantiateNodes } from './components/node.js';
import { instantiateRelationships } from './components/relationship.js';

let logger: winston.Logger; // defined later at startup

function loadFile(path: string): any {
    logger.info('Loading pattern from file: ' + path);
    const raw = fs.readFileSync(path, 'utf-8');

    logger.debug('Attempting to load pattern file: ' + raw);
    const pattern = JSON.parse(raw);

    logger.debug('Loaded pattern file.');
    return pattern;
}


function instantiateAdditionalTopLevelProperties(pattern: any, schemaDirectory: SchemaDirectory): any {
    const properties = pattern?.properties;
    if (!properties) {
        logger.error('Warning: pattern has no properties defined.');
        return [];
    }

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

export function generate(patternPath: string, schemaDirectory: SchemaDirectory, debug: boolean): CALMInstantiation {
    logger = initLogger(debug);
    const pattern = loadFile(patternPath);
    const outputNodes = instantiateNodes(pattern, schemaDirectory, debug);
    const relationshipNodes = instantiateRelationships(pattern, schemaDirectory, debug);
    const additionalProperties = instantiateAdditionalTopLevelProperties(pattern, schemaDirectory);

    const final = {
        'nodes': outputNodes,
        'relationships': relationshipNodes,
        ...additionalProperties // object spread operator to insert additional props at top level
    };

    return final;
}

export async function runGenerate(patternPath: string, outputPath: string, schemaDirectoryPath: string, debug: boolean): Promise<void> {
    const schemaDirectory = new SchemaDirectory(schemaDirectoryPath);

    if (!!schemaDirectoryPath) {
        await schemaDirectory.loadSchemas();
    }
    
    const final = generate(patternPath, schemaDirectory, debug);

    const output = JSON.stringify(final, null, 2);
    logger.debug('Generated instantiation: ' + output);

    const dirname = path.dirname(outputPath);

    mkdirp.sync(dirname);
    fs.writeFileSync(outputPath, output);
}
