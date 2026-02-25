/**
 * CALM Server - A server implementation for the Common Architecture Language Model
 */

import { Command } from 'commander';
import { version } from '../package.json';
import { startServer } from './server/cli-server';
import { SchemaDirectory, initLogger } from '@finos/calm-shared';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '@finos/calm-shared/dist/document-loader/document-loader';
import path from 'path';

const BUNDLED_SCHEMA_PATH = path.join(__dirname, 'calm');

const PORT_OPTION = '--port <port>';
const HOST_OPTION = '--host <host>';
const SCHEMAS_OPTION = '-s, --schema-directory <path>';
const VERBOSE_OPTION = '-v, --verbose';
const CALMHUB_URL_OPTION = '-c, --calm-hub-url <url>';
const RATE_LIMIT_WINDOW_OPTION = '--rate-limit-window <ms>';
const RATE_LIMIT_MAX_OPTION = '--rate-limit-max <requests>';

interface ParseDocumentLoaderOptions {
    verbose?: boolean;
    calmHubUrl?: string;
    schemaDirectory?: string;
    rateLimitWindow?: number;
    rateLimitMax?: number;
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
    .option(HOST_OPTION, 'Host to bind the server to', '127.0.0.1')
    .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', BUNDLED_SCHEMA_PATH)
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
    .option(RATE_LIMIT_WINDOW_OPTION, 'Rate limit window in milliseconds (default: 900000 = 15 minutes)', '900000')
    .option(RATE_LIMIT_MAX_OPTION, 'Max requests per IP within the rate limit window (default: 100)', '100')
    .action(async (options) => {
        try {
            const debug = !!options.verbose;
            const logger = initLogger(debug, 'calm-server');

            // Warn if host is explicitly provided (not default)
            if (options.host && options.host !== '127.0.0.1') {
                logger.warn('⚠️  WARNING: Server is configured to listen on ' + options.host);
                logger.warn('⚠️  This server has NO authentication or authorization controls.');
                logger.warn('⚠️  Only bind to non-localhost addresses in trusted network environments.');
            }

            const docLoaderOpts = await parseDocumentLoaderConfig(options);
            const docLoader = buildDocumentLoader(docLoaderOpts);
            const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
            startServer(
                options.port,
                options.host,
                schemaDirectory,
                debug,
                parseInt(options.rateLimitWindow),
                parseInt(options.rateLimitMax)
            );
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    });

program.parse(process.argv);

