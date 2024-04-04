#! /usr/bin/env node

import { program } from 'commander';
import visualize from './commands/visualize/visualize.js';
import { runGenerate } from './commands/generate/generate.js';

program
    .version('0.1.0')
    .description('A set of utilities for interacting with CALM');

program
    .command('visualize')
    .description('Produces an SVG file representing a visualization of the CALM Specification.')
    .requiredOption('-i, --instantiation <file>', 'Path to an instantiation of a CALM pattern.')
    .requiredOption('-o, --output <file>', 'Path location at which to output the SVG.', 'calm-visualization.svg')
    .option('-v, --verbose', 'Enable verbose logging.', false)
    .action((options) => { 
        visualize(options.instantiation, options.output, !!options.verbose);
    });

program
    .command('generate')
    .description('Generate an instantiation from a CALM pattern file.')
    .requiredOption('-p, --pattern <source>', 'Path to the pattern file to use. May be a file path or a URL.')
    .requiredOption('-o, --output <output>', 'Path location at which to output the generated file.')
    .option('-v, --verbose', 'Enable verbose logging.', false)
    .action((options) => {
        runGenerate(options.pattern, options.output, !!options.verbose);
    });

program.parse(process.argv);
