import * as fs from 'node:fs';
import * as path from 'node:path';
import {mkdirp} from 'mkdirp';

import * as winston from 'winston';
import {initLogger} from '../helper.js';
import {CALMInstantiation} from '../../types.js';
import {SchemaDirectory} from './schema-directory.js';
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

export async function runGenerate(patternPath: string, outputPath: string, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<void> {
    const final = await generate(patternPath, debug, instantiateAll, schemaDirectoryPath);

    const output = JSON.stringify(final, null, 2);
    const dirname = path.dirname(outputPath);

    logger.debug('Writing output to ' + outputPath);

    mkdirp.sync(dirname);
    fs.writeFileSync(outputPath, output);
}
