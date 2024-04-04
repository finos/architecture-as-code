#! /usr/bin/env node

import { program } from 'commander';
import visualize from './commands/visualize/visualize.js';
import { runGenerate } from './commands/generate/generate.js';
import validate  from './commands/validate/validate.js';

program
    .version('0.1.0')
    .description('A set of utilities for interacting with CALM');

program
    .command('visualize')
    .requiredOption('-i, --input <file>', 'The full path to the CALM Specification.')
    .requiredOption('-o, --output <file>', 'The name of the file to output the SVG in.', 'calm-visualization.svg')
    .description('Produces an SVG file representing a visualization of the CALM Specification.')
    .action(visualize);

program
    .command('generate')
    .description('Generate an instantiation from a CALM pattern file.')
    .requiredOption('-p, --pattern <source>', 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption('-o, --output <output>', 'Path location at which to output the generated file.')
    .option('-v, --verbose', 'Enable verbose logging.')
    .action((options) => {
        runGenerate(options.pattern, options.output, !!options.verbose);
    });

program
    .command('validate')
    .requiredOption('-p, --pattern <pattern>', 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption('-i, --instantiation <instantiation>', 'Path to the pattern instantiation file to use. May be a file path or a URL.')
    .option('-m, --metaSchemasLocation <metaSchemaLocation>', 'The location of the directory of the meta schemas to be loaded', '../calm/draft/2024-03/meta')
    .action(async (options)=> await validate(options.instantiation, options.pattern, options.metaSchemasLocation));

program.parse(process.argv);
