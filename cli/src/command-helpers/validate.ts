
import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared/logger';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import {Command} from 'commander';

export async function runValidate(options) {

    try {
        const outcome = await validate(options.architecture, options.pattern, options.schemaDirectory, options.verbose);
        const content = getFormattedOutput(outcome, options.format);
        writeOutputFile(options.output, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
        const logger = initLogger(options.verbose);
        logger.error('An error occurred while validating: ' + err.message);
        logger.debug(err.stack);
        process.exit(1);
    }
}


export function writeOutputFile(output: string, validationsOutput: string) {
    if (output) {
        const dirname = path.dirname(output);
        mkdirp.sync(dirname);
        writeFileSync(output, validationsOutput);
    } else {
        process.stdout.write(validationsOutput);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkValidateOptions(program: Command, options: any, patternOption: string, architectureOption: string) {
    if (!options.pattern && !options.architecture) {
        program.error(`error: one of the required options '${patternOption}' or '${architectureOption}' was not specified`);
    }
}