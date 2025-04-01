import {CALM_META_SCHEMA_DIRECTORY, runGenerate} from '@finos/calm-shared';
import { Option, Command } from 'commander';
import { version } from '../package.json';
import { CalmChoice } from '@finos/calm-shared/commands/generate/components/options';
import { loadFile } from './command-helpers/file-input';
import { promptUserForOptions } from './command-helpers/generate-options';

const FORMAT_OPTION = '-f, --format <format>';
const ARCHITECTURE_OPTION = '-a, --architecture <file>';
const OUTPUT_OPTION = '-o, --output <file>';
const PATTERN_OPTION = '-p, --pattern <file>';
const SCHEMAS_OPTION = '-s, --schemaDirectory <path>';
const STRICT_OPTION = '--strict';
const VERBOSE_OPTION = '-v, --verbose';

export function setupCLI(program: Command) {
    program
        .name('calm')
        .version(version)
        .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

    program
        .command('generate')
        .description('Generate an architecture from a CALM pattern file.')
        .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
        .requiredOption(OUTPUT_OPTION, 'Path location at which to output the generated file.', 'architecture.json')
        .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', CALM_META_SCHEMA_DIRECTORY)
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const pattern: object = await loadFile(options.pattern); // Ensure loadFile is awaited
            const choices: CalmChoice[] = await promptUserForOptions(pattern, options.verbose);
            await runGenerate(pattern, options.output, !!options.verbose, options.generateAll, choices, options.schemaDirectory);
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
            await runValidate(options);
        });

    program
        .command('server')
        .description('Start a HTTP server to proxy CLI commands. (experimental)')
        .option('-p, --port <port>', 'Port to run the server on', '3000')
        .requiredOption(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { startServer } = await import('./server/cli-server');
            startServer(options);
        });

    program
        .command('template')
        .description('Generate files from a CALM model using a Handlebars template bundle')
        .requiredOption('--input <path>', 'Path to the CALM model JSON file')
        .requiredOption('--bundle <path>', 'Path to the template bundle directory')
        .requiredOption('--output <path>', 'Path to output directory')
        .option('--url-to-local-file-mapping <path>', 'Path to mapping file which maps URLs to local paths')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const { TemplateProcessor } = await import('@finos/calm-shared');
            if (options.verbose) {
                process.env.DEBUG = 'true';
            }
            const localDirectory = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            const processor = new TemplateProcessor(options.input, options.bundle, options.output, localDirectory);
            await processor.processTemplate();
        });

    program
        .command('docify')
        .description('Generate a documentation website off your CALM model')
        .requiredOption('--input <path>', 'Path to the CALM model JSON file')
        .requiredOption('--output <path>', 'Path to output directory')
        .option('--url-to-local-file-mapping <path>', 'Path to mapping file which maps URLs to local paths')
        .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
        .action(async (options) => {
            const { getUrlToLocalFileMap } = await import('./command-helpers/template');
            const { Docifier } = await import('@finos/calm-shared');
            if (options.verbose) {
                process.env.DEBUG = 'true';
            }
            const localDirectory = getUrlToLocalFileMap(options.urlToLocalFileMapping);
            const docifier = new Docifier('WEBSITE', options.input, options.output, localDirectory);
            await docifier.docify();
        });
}
