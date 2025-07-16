import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader, DocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader';

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
        const docLoader: DocumentLoader = buildDocumentLoader(docLoaderOpts, debug);
        const schemaDirectory = await buildSchemaDirectory(docLoader, debug);

        const { architecture, pattern } = await loadArchitectureAndPattern(
            options.architecturePath,
            options.patternPath,
            docLoader
        );

        const outcome = await validate(architecture, pattern, schemaDirectory, options.verbose);
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

// Update loadArchitectureAndPattern and helpers to use DocumentLoader type
async function loadArchitectureAndPattern(architecturePath: string, patternPath: string, docLoader: DocumentLoader): Promise<{ architecture: object, pattern: object }> {
    const architecture = await loadArchitecture(architecturePath, docLoader);
    if (!architecture) {
        // we have already validated that at least one of the options is provided, so pattern must be set
        const pattern = await loadPattern(patternPath, docLoader);
        return { architecture: undefined, pattern };
    }
    if (patternPath) {
        // both options set
        const pattern = await loadPattern(patternPath, docLoader);
        return { architecture, pattern };
    }
    // architecture is set, but pattern is not; try to load pattern from architecture if present 
    return { architecture, pattern: await loadPatternFromArchitectureIfPresent(architecture, docLoader) };
}

async function loadPatternFromArchitectureIfPresent(architecture: object, docLoader: DocumentLoader): Promise<object> {
    if (!architecture || !architecture['$schema']) {
        return;
    }
    return docLoader.loadMissingDocument(architecture['$schema'], 'pattern');
}

async function loadPattern(patternPath: string, docLoader: DocumentLoader): Promise<object> {
    if (!patternPath) {
        return undefined;
    }
    return docLoader.loadMissingDocument(patternPath, 'pattern');
}

async function loadArchitecture(architecturePath: string, docLoader: DocumentLoader): Promise<object> {
    if (!architecturePath) {
        return undefined;
    }
    return docLoader.loadMissingDocument(architecturePath, 'architecture');
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