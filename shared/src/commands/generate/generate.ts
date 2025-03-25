import * as fs from 'node:fs';
import * as path from 'node:path';
import {mkdirp} from 'mkdirp';

import logger from 'winston';
import {CALMArchitecture} from '../../types.js';
import {SchemaDirectory} from '../../schema-directory.js';
import {instantiateNodes} from './components/node.js';
import {instantiateRelationships} from './components/relationship.js';
import {CALM_META_SCHEMA_DIRECTORY} from '../../consts.js';
import {instantiateAllMetadata} from './components/metadata.js';
import { CalmChoice, selectChoices } from './components/options.js';

export async function generate(pattern: object, debug: boolean, instantiateAll: boolean, schemaDirectoryPath?: string): Promise<CALMArchitecture> {
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

export async function runGenerate(pattern: object, outputPath: string, debug: boolean, instantiateAll: boolean, chosenChoices?: CalmChoice[], schemaDirectoryPath?: string): Promise<void> {
    try {
        if (chosenChoices) {
            pattern = selectChoices(pattern, chosenChoices);
        }

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
