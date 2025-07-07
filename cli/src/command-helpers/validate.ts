
import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import {Command} from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { loadPatternJson, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader';

export interface ValidateOptions {
    patternPath?: string;
    architecturePath?: string;
    metaSchemaPath: string;
    verbose: boolean;
    strict: boolean;
    outputFormat: ValidateOutputFormat;
    outputPath: string;
}

export async function runValidate(options: ValidateOptions) {
    try {
        const debug = !!options.verbose;
        const docLoaderOpts = await parseDocumentLoaderConfig(options);
        const docLoader = buildDocumentLoader(docLoaderOpts, debug);
        // const schemaDirectory = await buildSchemaDirectory(docLoader, debug);
        const architecture = options.architecturePath ? await loadPatternJson(options.architecturePath, docLoader, debug) : undefined;
        const pattern = options.patternPath ? await loadPatternJson(options.patternPath, docLoader, debug) : undefined;
        const outcome = await validate(architecture, pattern, options.metaSchemaPath, options.verbose);
        const content = getFormattedOutput(outcome, options.outputFormat);
        writeOutputFile(options.outputPath, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
        const logger = initLogger(options.verbose, 'calm-validate');
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