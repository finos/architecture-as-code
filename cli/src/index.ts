#! /usr/bin/env node

import {CALM_META_SCHEMA_DIRECTORY, runGenerate, TemplateProcessor} from '@finos/calm-shared';
import { Option, program } from 'commander';

import { version } from '../package.json';
import { startServer } from './server/cli-server';
import {checkValidateOptions, runValidate} from './validate/validate';

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
    .action(async (options) =>
        await runGenerate(options.pattern, options.output, !!options.verbose, options.generateAll, options.schemaDirectory)
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
        checkValidateOptions(program, options, PATTERN_OPTION, ARCHITECTURE_OPTION);
        await runValidate(options);
    });



program
    .command('server')
    .description('Start a HTTP server to proxy CLI commands. (experimental)')
    .option('-p, --port <port>', 'Port to run the server on', '3000')
    .requiredOption(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .action((options) => {
        startServer(options);
    });


program
    .command('template')
    .description('Generate files from a CALM model using a Handlebars template bundle')
    .requiredOption('--input <path>', 'Path to the CALM model JSON file')
    .requiredOption('--bundle <path>', 'Path to the template bundle directory')
    .requiredOption('--output <path>', 'Path to output directory')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .action(async (options) => {
        if(options.verbose){
            process.env.DEBUG = 'true';
        }

        const processor = new TemplateProcessor(options.input, options.bundle, options.output);
        await processor.processTemplate();
    });

program.parse(process.argv);