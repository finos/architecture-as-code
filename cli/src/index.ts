#! /usr/bin/env node

import { program } from 'commander';
import visualize from './commands/visualize/visualize.js';
import { runGenerate } from './commands/generate/generate.js';

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
    .requiredOption('-s, --source <source>', 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption('-o, --output <output>', 'Path location at which to output the generated file.')
    .option('-v, --verbose', 'Enable verbose logging.')
    .action((options) => {
        runGenerate(options.source, options.output, !!options.verbose);
    });

program.parse(process.argv);
