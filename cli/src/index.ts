#! /usr/bin/env node

import { Option, program } from 'commander';
import { visualizeInstantiation, visualizePattern } from './commands/visualize/visualize.js';
import { runGenerate } from './commands/generate/generate.js';
import validate  from './commands/validate/validate.js';
import { CALM_META_SCHEMA_DIRECTORY } from './consts.js';

const FORMAT_OPTION = '-f, --format <format>';
const INSTANTIATION_OPTION = '-i, --instantiation <file>';
const INSTANTIATE_ALL_OPTION = '-a, --instantiateAll';
const OUTPUT_OPTION = '-o, --output <file>';
const PATTERN_OPTION = '-p, --pattern <file>';
const SCHEMAS_OPTION = '-s, --schemaDirectory <path>';
const STRICT_OPTION = '-s, --strict';
const VERBOSE_OPTION = '-v, --verbose';

program
    .version('0.2.5')
    .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

program
    .command('visualize')
    .description('Produces an SVG file representing a visualization of the CALM Specification.')
    .addOption(new Option(INSTANTIATION_OPTION, 'Path to an instantiation of a CALM pattern.').conflicts('pattern'))
    .addOption(new Option(PATTERN_OPTION, 'Path to a CALM pattern.').conflicts('instantiation'))
    .requiredOption(OUTPUT_OPTION, 'Path location at which to output the SVG.', 'calm-visualization.svg')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .action(async (options) => {
        if (options.instantiation) {
            await visualizeInstantiation(options.instantiation, options.output, !!options.verbose);
        } else if (options.pattern) {
            await visualizePattern(options.pattern, options.output, !!options.verbose);
        } else {
            program.error(`error: one of required options '${INSTANTIATION_OPTION}' or '${PATTERN_OPTION}' not specified`);
        }
    });

program
    .command('generate')
    .description('Generate an instantiation from a CALM pattern file.')
    .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption(OUTPUT_OPTION, 'Path location at which to output the generated file.', 'instantiation.json')
    .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .option(INSTANTIATE_ALL_OPTION, 'Instantiate all properties, ignoring the "required" field.', false)
    .action(async (options) =>
        await runGenerate(options.pattern, options.output, !!options.verbose, options.instantiateAll, options.schemaDirectory)
    );

program
    .command('validate')
    .description('Validate that an instantiation conforms to a given CALM pattern.')
    .requiredOption(PATTERN_OPTION, 'Path to the pattern file to use. May be a file path or a URL.')
    .option(INSTANTIATION_OPTION, 'Path to the pattern instantiation file to use. May be a file path or a URL.')
    .option(SCHEMAS_OPTION, 'Path to the directory containing the meta schemas to use.', CALM_META_SCHEMA_DIRECTORY)
    .option(STRICT_OPTION, 'When run in strict mode, the CLI will fail if any warnings are reported.', false)
    .addOption(
        new Option(FORMAT_OPTION, 'The format of the output')
            .choices(['json', 'junit'])
            .default('json')
    )
    .option(OUTPUT_OPTION, 'Path location at which to output the generated file.')
    .option(VERBOSE_OPTION, 'Enable verbose logging.', false)
    .action(async (options) =>
        await validate(options.instantiation, options.pattern, options.metaSchemasLocation, options.verbose, options.format, options.output, options.strict)
    );

program.parse(process.argv);
