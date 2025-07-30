import {CALM_META_SCHEMA_DIRECTORY, DocifyMode, initLogger, runGenerate, SchemaDirectory} from '@finos/calm-shared';
import { Option, Command } from 'commander';
import { version } from '../package.json';
import { promptUserForOptions } from './command-helpers/generate-options';
import { CalmChoice } from '@finos/calm-shared/dist/commands/generate/components/options';
import { buildDocumentLoader, DocumentLoader, DocumentLoaderOptions } from '@finos/calm-shared/dist/document-loader/document-loader';
import { loadCliConfig } from './cli-config';
import {TemplateProcessingMode} from '@finos/calm-shared/dist/template/template-processor';

const FORMAT_OPTION = '-f, --format <format>';
const ARCHITECTURE_OPTION = '-a, --architecture <file>';
const OUTPUT_OPTION = '-o, --output <file>';
const PATTERN_OPTION = '-p, --pattern <file>';
const SCHEMAS_OPTION = '-s, --schemaDirectory <path>';
const STRICT_OPTION = '--strict';
const VERBOSE_OPTION = '-v, --verbose';
const CALMHUB_URL_OPTION = '-c, --calmHubUrl <url>';

export function setupCLI(program: Command) {
    program
        .name('calm')
        .version(version)
        .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

    program
        .command('generate')
        .description('Generate an architecture from a CALM pattern file.')
        .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a CalmHub URL.')
        .requiredOption(OUTPUT_OPTION, 'Path location at which to output the generated file.', 'architecture.json')
        .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
        .option(CALMHUB_URL_OPTION, 'URL to CALMHub instance')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const debug = !!options.verbose;
            const docLoaderOpts = await parseDocumentLoaderConfig(options);
            const docLoader = buildDocumentLoader(docLoaderOpts);
            const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
            const pattern: object = await docLoader.loadMissingDocument(options.pattern, 'pattern');
            const choices: CalmChoice[] = await promptUserForOptions(pattern, options.verbose);
            await runGenerate(pattern, options.output, debug, schemaDirectory, choices);
        });

    program
        .command('validate')
        .description('Validate that an architecture conforms to a given CALM pattern.')
        .option(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
        .option(ARCHITECTURE_OPTION, 'Path to the architecture file to use. May be a file path or a URL.')
        .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', CALM_META_SCHEMA_DIRECTORY)
        .option(STRICT_OPTION, 'When run in strict mode, the CLI will fail if any warnings are reported.', false)
        .addOption(
            new Option(FORMAT_OPTION, 'The format of the output')
                .choices(['json', 'junit', 'pretty'])
                .default('json')
        )
        .option(OUTPUT_OPTION, 'Path location at which to output the generated file.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { checkValidateOptions, runValidate } = await import('./command-helpers/validate');
            checkValidateOptions(program, options, PATTERN_OPTION, ARCHITECTURE_OPTION);
            await runValidate({
                architecturePath: options.architecture,
                patternPath: options.pattern,
                metaSchemaPath: options.schemaDirectory,
                verbose: !!options.verbose,
                strict: options.strict,
                outputFormat: options.format,
                outputPath: options.output
            });
        });

    program
        .command('server')
        .description('Start a HTTP server to proxy CLI commands. (experimental)')
        .option('-p, --port <port>', 'Port to run the server on', '3000')
        .requiredOption(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { startServer } = await import('./server/cli-server');
            const debug = !!options.verbose;
            const docLoaderOpts = await parseDocumentLoaderConfig(options);
            const docLoader = buildDocumentLoader(docLoaderOpts);
            const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
            startServer(options.port, schemaDirectory, debug);
        });

    program
        .command('template')
        .description('Generate files from a CALM model using a template bundle, a single file, or a directory of templates')
        .requiredOption('--input <path>', 'Path to the CALM model JSON file')
        .requiredOption('--output <path>', 'Path to output directory or file')
        .option('--bundle <path>', 'Path to the template bundle directory')
        .option('--template <path>', 'Path to a single .hbs or .md template file')
        .option('--template-dir <path>', 'Path to a directory of .hbs/.md templates')
        .option('--url-to-local-file-mapping <path>', 'Path to mapping file which maps URLs to local paths')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const { TemplateProcessor } = await import('@finos/calm-shared');
            if (options.verbose) {
                process.env.DEBUG = 'true';
            }
            const localDirectory = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            let mode: TemplateProcessingMode;
            let templatePath: string;

            const flagsUsed = [options.template, options.templateDir, options.bundle].filter(Boolean);

            if (flagsUsed.length !== 1) {
                console.error('❌ Please specify exactly one of --template, --template-dir, or --bundle');
                process.exit(1);
            }

            if (options.template) {
                templatePath = options.template;
                mode = 'template';
            } else if (options.templateDir) {
                templatePath = options.templateDir;
                mode = 'template-directory';
            } else {
                templatePath = options.bundle;
                mode = 'bundle';
            }

            const processor = new TemplateProcessor(
                options.input,
                templatePath,
                options.output,
                localDirectory,
                mode
            );

            await processor.processTemplate();
        });

    program
        .command('docify')
        .description('Generate a documentation website from your CALM model using a template or template directory')
        .requiredOption('--input <path>', 'Path to the CALM model JSON file')
        .requiredOption('--output <path>', 'Path to output directory')
        .option('--template <path>', 'Path to a single .hbs or .md template file')
        .option('--template-dir <path>', 'Path to a directory of .hbs/.md templates')
        .option('--url-to-local-file-mapping <path>', 'Path to mapping file which maps URLs to local paths')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const { Docifier } = await import('@finos/calm-shared');

            if (options.verbose) {
                process.env.DEBUG = 'true';
            }

            const localDirectory = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            const flagsUsed = [options.template, options.templateDir].filter(Boolean);

            if (flagsUsed.length > 1) {
                console.error('❌ Please specify only one of --template or --template-dir');
                process.exit(1);
            }

            let docifyMode: DocifyMode = 'WEBSITE';
            let templateProcessingMode: TemplateProcessingMode = 'bundle';
            let templatePath: string | undefined = undefined;

            if (options.template) {
                docifyMode = 'USER_PROVIDED';
                templateProcessingMode = 'template';
                templatePath = options.template;
            } else if (options.templateDir) {
                docifyMode = 'USER_PROVIDED';
                templateProcessingMode = 'template-directory';
                templatePath = options.templateDir;
            }

            const docifier = new Docifier(
                docifyMode,
                options.input,
                options.output,
                localDirectory,
                templateProcessingMode,
                templatePath
            );

            await docifier.docify();
        });

}

export async function parseDocumentLoaderConfig(options): Promise<DocumentLoaderOptions> {
    const logger = initLogger(options.verbose, 'calm-cli');
    const docLoaderOpts: DocumentLoaderOptions = {
        calmHubUrl: options.calmHubUrl,
        schemaDirectoryPath: options.schemaDirectory,
        debug: !!options.verbose
    };

    const userConfig = await loadCliConfig();
    if (userConfig && userConfig.calmHubUrl && !options.calmHubUrl) {
        logger.info('Using CALMHub URL from config file: ' + userConfig.calmHubUrl);
        docLoaderOpts.calmHubUrl = userConfig.calmHubUrl;
    }
    return docLoaderOpts;
}

export async function buildSchemaDirectory(docLoader: DocumentLoader, debug: boolean): Promise<SchemaDirectory> {
    return new SchemaDirectory(docLoader, debug);
}