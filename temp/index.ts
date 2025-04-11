#! /usr/bin/env node

import { CALM_META_SCHEMA_DIRECTORY, getFormattedOutput, runGenerate, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { Option, program } from 'commander';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import { version } from '../package.json';
import { initLogger } from '@finos/calm-shared/logger';
import { startServer } from './server/cli-server';
import { DocumentLoaderOptions } from '@finos/calm-shared/document-loader/document-loader';

const FORMAT_OPTION = '-f, --format <format>';
const ARCHITECTURE_OPTION = '-a, --architecture <file>';
const GENERATE_ALL_OPTION = '-g, --generateAll';
const OUTPUT_OPTION = '-o, --output <file>';
const PATTERN_OPTION = '-p, --pattern <file>';
const SCHEMAS_OPTION = '-s, --schemaDirectory <path>';
const STRICT_OPTION = '--strict';
const VERBOSE_OPTION = '-v, --verbose';



program
    .name('calm')
    .version(version)
    .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

program
    .command('generate')
    .description('Generate an architecture from a CALM pattern file.')
    .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption(OUTPUT_OPTION, 'Path location at which to output the generated file.', 'architecture.json')
    .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .option(GENERATE_ALL_OPTION, 'Generate all properties, ignoring the "required" field.', false)
    .action(async (options) => {
        const docLoaderOpts = await parseDocumentLoaderConfig(options);
        await runGenerate(options.pattern, options.output, !!options.verbose, options.generateAll, docLoaderOpts);
    }
    );

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
        await runValidate(options);
    });


/**
 * Run the validate command and exit with the right status code based on the result.
 * @param options Options passed through from the argument parser.
 */
async function runValidate(options) {
    if (!options.pattern && !options.architecture) {
        program.error(`error: one of the required options '${PATTERN_OPTION}' or '${ARCHITECTURE_OPTION}' was not specified`);
    }
    try {
        const outcome = await validate(options.architecture, options.pattern, options.schemaDirectory, options.verbose);
        const content = getFormattedOutput(outcome, options.format);
        writeOutputFile(options.output, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
        const logger = initLogger(options.verbose);
        logger.error('An error occurred while validating: ' + err.message);
        logger.debug(err.stack);
        process.exit(1);
    }
}

program
    .command('server')
    .description('Start a HTTP server to proxy CLI commands. (experimental)')
    .option('-p, --port <port>', 'Port to run the server on', '3000')
    .requiredOption(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .action((options) => {
        startServer(options);
    });

function writeOutputFile(output: string, validationsOutput: string) {
    if (output) {
        const dirname = path.dirname(output);
        mkdirp.sync(dirname);
        writeFileSync(output, validationsOutput);
    } else {
        process.stdout.write(validationsOutput);
    }
}

async function parseDocumentLoaderConfig(options): Promise<DocumentLoaderOptions> {
    if (options.calmHubUrl && options.schemaDirectory) {
        program.error('At most one of --schemaDirectory and --calmHubUrl is supported; both were provided.');
    }
    if (options.schemaDirectory) {
        return {
            loadMode: 'filesystem',
            schemaDirectoryPath: options.schemaDirectory
        };
    }

    return {
        loadMode: 'filesystem',
        schemaDirectoryPath: undefined
    };
}

program.parse(process.argv);