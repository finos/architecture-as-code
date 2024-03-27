#! /usr/bin/env node

import { program } from 'commander';
import visualize from './commands/visualize/visualize.js';

program
    .version('0.1.0')
    .description('A set of utilities for interacting with CALM');

program
    .command('visualize')
    .requiredOption('-i, --input <file>', 'The full path to the CALM Specification.')
    .requiredOption('-o, --output <file>', 'The name of the file to output the SVG in.', 'calm-visualization.svg')
    .description('Produces an SVG file representing a visualization of the CALM Specification.')
    .action(visualize);

program.parse(process.argv);
