/**
 * CALM Server - A server implementation for the Common Architecture Language Model
 */

import { Command } from 'commander';
import { version } from '../package.json';
import { startServer } from './server/cli-server';
import { SchemaDirectory, initLogger } from '@finos/calm-shared';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '@finos/calm-shared/dist/document-loader/document-loader';
import { loadCliConfig } from './cli-config';
import path from 'path';

const BUNDLED_SCHEMA_PATH = path.join(__dirname, 'calm');

const PORT_OPTION = '--port <port>';
const SCHEMAS_OPTION = '-s, --schema-directory <path>';
const VERBOSE_OPTION = '-v, --verbose';
const CALMHUB_URL_OPTION = '-c, --calm-hub-url <url>';

interface ParseDocumentLoaderOptions {
    verbose?: boolean;
    calmHubUrl?: string;
    schemaDirectory?: string;
}

async function parseDocumentLoaderConfig(
    options: ParseDocumentLoaderOptions,
    urlToLocalMap?: Map<string, string>,
    basePath?: string
): Promise<DocumentLoaderOptions> {
    const logger = initLogger(options.verbose, 'calm-server');
    const docLoaderOpts: DocumentLoaderOptions = {
        calmHubUrl: options.calmHubUrl,
        schemaDirectoryPath: options.schemaDirectory,
        urlToLocalMap: urlToLocalMap,
        basePath: basePath,
        debug: !!options.verbose
    };

    const userConfig = await loadCliConfig();
    if (userConfig && userConfig.calmHubUrl && !options.calmHubUrl) {
        logger.info('Using CALMHub URL from config file: ' + userConfig.calmHubUrl);
        docLoaderOpts.calmHubUrl = userConfig.calmHubUrl;
    }
    return docLoaderOpts;
}

async function buildSchemaDirectory(docLoader: DocumentLoader, debug: boolean): Promise<SchemaDirectory> {
    return new SchemaDirectory(docLoader, debug);
}

const program = new Command();

program
    .name('calm-server')
    .version(version)
    .description('CALM Server - A server implementation for the Common Architecture Language Model')
    .option(PORT_OPTION, 'Port to run the server on', '3000')
    .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', BUNDLED_SCHEMA_PATH)
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
    .action(async (options) => {
        try {
            const debug = !!options.verbose;
            const docLoaderOpts = await parseDocumentLoaderConfig(options);
            const docLoader = buildDocumentLoader(docLoaderOpts);
            const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
            startServer(options.port, schemaDirectory, debug);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    });

program.parse(process.argv);

