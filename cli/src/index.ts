#!/usr/bin/env node

import { Option, program } from 'commander';
import { validate, CALM_META_SCHEMA_DIRECTORY, getFormattedOutput, visualizePattern, visualizeInstantiation, runGenerate } from '@finos/calm-shared';
import { writeFileSync } from 'fs';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { exitBasedOffOfValidationOutcome } from '@finos/calm-shared/dist/commands/validate/validate';
import { version } from '../package.json';

program
    .version(version)
    .description('A set of tools for interacting with the Common Architecture Language Model (CALM)');

program
    .command('visualize')
    .description('Produces an SVG file representing a visualization of the CALM Specification.')
    .addOption(new Option('-i, --instantiation <file>', 'Path to an instantiation of a CALM pattern.').conflicts('pattern'))
    .addOption(new Option('-p, --pattern <file>', 'Path to a CALM pattern.').conflicts('instantiation'))
    .requiredOption('-o, --output <file>', 'Path location at which to output the SVG.', 'calm-visualization.svg')
    .option('-v, --verbose', 'Enable verbose logging.', false)    
    .action(async (options) => {
        if (!options.instantiation && !options.pattern) {
            throw new Error('You must provide either a pattern or an instantiation');
        } else if (options.instantiation) {
            await visualizeInstantiation(options.instantiation, options.output, !!options.verbose);
        } else if (options.pattern) {
            await visualizePattern(options.pattern, options.output, !!options.verbose);
        }
    });

program
    .command('generate')
    .description('Generate an instantiation from a CALM pattern file.')
    .requiredOption('-p, --pattern <source>', 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption('-o, --output <output>', 'Path location at which to output the generated file.', 'instantiation.json')
    .option('-s, --schemaDirectory <path>', 'Path to directory containing schemas to use in instantiation')
    .option('-v, --verbose', 'Enable verbose logging.', false)
    .option('-a, --instantiateAll', 'Instantiate all properties, ignoring the "required" field.', false)
    .action(async (options) => {
        await runGenerate(options.pattern, options.output, !!options.verbose, options.instantiateAll, options.schemaDirectory
        );
    });

program
    .command('validate')
    .description('Validate that an instantiation conforms to a given CALM pattern.')
    .requiredOption('-p, --pattern <pattern>', 'Path to the pattern file to use. May be a file path or a URL.')
    .option('-i, --instantiation <instantiation>', 'Path to the pattern instantiation file to use. May be a file path or a URL.')
    .option('-m, --metaSchemasLocation <metaSchemaLocation>', 'The location of the directory of the meta schemas to be loaded', CALM_META_SCHEMA_DIRECTORY)
    .option('--strict', 'When run in strict mode, the CLI will fail if any warnings are reported.', false)
    .addOption(
        new Option('-f, --format <format>', 'The format of the output')
            .choices(['json', 'junit'])
            .default('json')
    )
    .option('-o, --output <output>', 'Path location at which to output the generated file. If not provided the contents will be printed to the console in JSON format.')
    .option('-v, --verbose', 'Enable verbose logging.', false)
    .action(async (options) => {
        const outcome = await validate(options.instantiation, options.pattern, options.metaSchemasLocation, options.verbose);
        const content = getFormattedOutput(outcome, options.format, options.instantiation, options.pattern);
        writeOutputFile(options.output, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    });


function writeOutputFile(output: string, validationsOutput: string) {
    if (output) {
        const dirname = path.dirname(output);
        mkdirp.sync(dirname);
        writeFileSync(output, validationsOutput);
    } else {
        console.log(validationsOutput);
    }
}

program.parse(process.argv);

