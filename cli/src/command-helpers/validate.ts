import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, SchemaDirectory } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader, DocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader';
import { Logger } from '@finos/calm-shared/dist/logger';

export interface ValidateOptions {
    patternPath?: string;
    architecturePath?: string;
    timelinePath?: string;
    metaSchemaPath: string;
    verbose: boolean;
    strict: boolean;
    outputFormat: ValidateOutputFormat;
    outputPath: string;
}

export async function runValidate(options: ValidateOptions) {
    const logger = initLogger(options.verbose, 'calm-validate');
    try {
        const docLoaderOpts = await parseDocumentLoaderConfig(options);
        const docLoader: DocumentLoader = buildDocumentLoader(docLoaderOpts);
        const schemaDirectory = await buildSchemaDirectory(docLoader, options.verbose);
        await schemaDirectory.loadSchemas();

        let architecture: object;
        let pattern: object;
        let timeline: object;

        if (options.timelinePath) {
            const result = await loadTimeline(
                options.timelinePath,
                docLoader,
                schemaDirectory,
                logger
            );
            timeline = result.timeline;
            pattern = result.pattern;
        }
        else {
            const result = await loadArchitectureAndPattern(
                options.architecturePath,
                options.patternPath,
                docLoader,
                schemaDirectory,
                logger
            );
            architecture = result.architecture;
            pattern = result.pattern;
        }
        const outcome = await validate(architecture, pattern, timeline, schemaDirectory, options.verbose);
        const content = getFormattedOutput(outcome, options.outputFormat);
        writeOutputFile(options.outputPath, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
        logger.error('An error occurred while validating: ' + err.message);
        logger.debug(err.stack);
        process.exit(1);
    }
}

// Update loadArchitectureAndPattern and helpers to use DocumentLoader type
async function loadArchitectureAndPattern(architecturePath: string, patternPath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<{ architecture: object, pattern: object }> {
    const architecture = await loadArchitecture(architecturePath, docLoader, logger);
    if (!architecture) {
        // we have already validated that at least one of the options is provided, so pattern must be set
        const pattern = await loadPattern(patternPath, docLoader, logger);
        return { architecture: undefined, pattern };
    }
    if (patternPath) {
        // both options set
        const pattern = await loadPattern(patternPath, docLoader, logger);
        return { architecture, pattern };
    }
    // architecture is set, but pattern is not; try to load pattern from architecture if present 
    return { architecture, pattern: await loadPatternFromArchitectureIfPresent(architecture, docLoader, schemaDirectory, logger) };
}

async function loadPatternFromArchitectureIfPresent(architecture: object, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<object> {
    if (!architecture || !architecture['$schema']) {
        return;
    }
    try {
        const schema = schemaDirectory.getSchema(architecture['$schema']);
        logger.debug(`Loaded schema from architecture: ${architecture['$schema']}`);
        return schema;
    }
    catch (_) {
        logger.debug(`Trying to load pattern from architecture schema: ${architecture['$schema']}`);
    }
    const pattern = docLoader.loadMissingDocument(architecture['$schema'], 'pattern');
    logger.debug(`Loaded pattern from architecture schema: ${architecture['$schema']}`);
    return pattern;
}

async function loadPattern(patternPath: string, docLoader: DocumentLoader, logger: Logger): Promise<object> {
    if (!patternPath) {
        return undefined;
    }
    const pattern = docLoader.loadMissingDocument(patternPath, 'pattern');
    logger.debug(`Loaded pattern from ${patternPath}`);
    return pattern;
}

async function loadArchitecture(architecturePath: string, docLoader: DocumentLoader, logger: Logger): Promise<object> {
    if (!architecturePath) {
        return undefined;
    }
    const arch = docLoader.loadMissingDocument(architecturePath, 'architecture');
    logger.debug(`Loaded architecture from ${architecturePath}`);
    return arch;
}

async function loadTimeline(timelinePath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<{ timeline: object, pattern: object }> {
    const timeline = await docLoader.loadMissingDocument(timelinePath, 'timeline');
    logger.debug(`Loaded timeline from ${timelinePath}`);

    return { timeline, pattern: await loadPatternFromArchitectureIfPresent(timeline, docLoader, schemaDirectory, logger) };
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
export function checkValidateOptions(program: Command, options: any, patternOption: string, architectureOption: string,
                                     timelineOption: string) {
    if (options.timeline && (options.pattern || options.architecture)) {
        program.error(`error: the option '${timelineOption}' cannot be used with either of the options '${patternOption}' or '${architectureOption}'`);
    }
    if (!options.pattern && !options.architecture && !options.timeline) {
        program.error(`error: one of the required options '${patternOption}', '${architectureOption}' or '${timelineOption}' was not specified`);
    }
}