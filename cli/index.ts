#! /usr/bin/env node

import { program } from 'commander';

program
    .version('0.1.0')
    .description('A set of utilities for interacting with CALM');

program
    .command('placeholder <input>')
    .description('This is just a placeholder. Replace with an actual command.')
    .action((input) => { console.log(input); });

program.parse(process.argv);
