import { program } from 'commander';
import { setupCLI } from './cli';

setupCLI(program);
program.parseAsync(process.argv).catch(err => {
    if (err && err.message) {
        console.error('\n' + err.message);
    }
    else {
        console.error('\nAn unexpected error occurred:', err);
    }
    process.exit(1);
});