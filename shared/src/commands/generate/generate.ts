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
import { FileSystemDocumentLoader } from '@finos/calm-shared/document-loader/file-system-document-loader.js';
import { DocumentLoader, DocumentLoaderOptions } from '@finos/calm-shared/document-loader/document-loader.js';
import { CALMHubDocumentLoader } from '@finos/calm-shared/document-loader/calmhub-document-loader.js';

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

function getDocumentLoader(docLoaderOpts: DocumentLoaderOptions, debug: boolean): DocumentLoader {
    switch(docLoaderOpts.loadMode) {
        case 'filesystem': 
            // TODO allow it to load multiple directories so we can load core schemas and an additional schemaDir
            return new FileSystemDocumentLoader(CALM_META_SCHEMA_DIRECTORY, debug);
        case 'calmhub':
            return new CALMHubDocumentLoader(docLoaderOpts.calmHubUrl, debug);
    }
}

export async function generate(patternPath: string, debug: boolean, instantiateAll: boolean, docLoaderOpts: DocumentLoaderOptions): Promise<CALMArchitecture> {
    logger = initLogger(debug);
    const documentLoader = getDocumentLoader(docLoaderOpts, debug);
    const schemaDirectory = new SchemaDirectory(documentLoader);

    try {

        await schemaDirectory.loadSchemas(CALM_META_SCHEMA_DIRECTORY);
        // if (schemaDirectoryPath) {
        //     await schemaDirectory.loadSchemas(schemaDirectoryPath);
        // }
    }
    catch (err) {
        logger.error('Error while trying to load schemas: ' + err.message);
        throw err;
    }

    const pattern = loadFile(patternPath);
    schemaDirectory.loadCurrentPatternAsSchema(pattern);

    const outputNodes = await instantiateNodes(pattern, schemaDirectory, debug, instantiateAll);
    const relationshipNodes = await instantiateRelationships(pattern, schemaDirectory, debug, instantiateAll);
    const metadata = await instantiateAllMetadata(pattern, schemaDirectory, debug, instantiateAll);

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

export async function runGenerate(patternPath: string, outputPath: string, debug: boolean, instantiateAll: boolean, docLoaderOpts: DocumentLoaderOptions): Promise<void> {
    try {
        const final = await generate(patternPath, debug, instantiateAll, docLoaderOpts);
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
