import { program } from 'commander';
import { setupCLI } from './cli';

setupCLI(program);
program.parse(process.argv);