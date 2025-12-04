import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, SchemaDirectory } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader, DocumentLoader, CALM_HUB_PROTO } from '@finos/calm-shared/dist/document-loader/document-loader';
import { Logger } from '@finos/calm-shared/dist/logger';

export interface ValidateOptions {
    patternPath?: string;
    architecturePath?: string;
    metaSchemaPath: string;
    calmHubUrl?: string;
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

        const { architecture, pattern } = await loadArchitectureAndPattern(
            options.architecturePath,
            options.patternPath,
            docLoader,
            schemaDirectory,
            logger
        );
        const outcome = await validate(architecture, pattern, schemaDirectory, options.verbose);
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
    return { architecture, pattern: await loadPatternFromArchitectureIfPresent(architecture, architecturePath, docLoader, schemaDirectory, logger) };
}

export function resolveSchemaRef(schemaRef: string, architecturePath: string, logger: Logger): string {
    // If it's an absolute URL or calm: protocol, use as-is
    if (schemaRef.startsWith('http://') || schemaRef.startsWith('https://') || schemaRef.startsWith(CALM_HUB_PROTO)) {
        return schemaRef;
    }
    // If it's an absolute file path, use as-is
    if (path.isAbsolute(schemaRef)) {
        return schemaRef;
    }
    // It's a relative path - resolve it relative to the architecture file's directory
    if (architecturePath) {
        const archDir = path.dirname(path.resolve(architecturePath));
        const resolved = path.resolve(archDir, schemaRef);
        logger.debug(`Resolved relative $schema path '${schemaRef}' to: ${resolved}`);
        return resolved;
    }
    logger.warn(`Could not resolve relative $schema path '${schemaRef}' because architecturePath is missing or falsy. Returning unresolved relative path.`);
    return schemaRef;
}

async function loadPatternFromArchitectureIfPresent(architecture: object, architecturePath: string, docLoader: DocumentLoader, schemaDirectory: SchemaDirectory, logger: Logger): Promise<object> {
    if (!architecture || !architecture['$schema']) {
        return;
    }
    const schemaRef = resolveSchemaRef(architecture['$schema'], architecturePath, logger);
    try {
        const schema = schemaDirectory.getSchema(schemaRef);
        logger.debug(`Loaded schema from architecture: ${schemaRef}`);
        return schema;
    }
    catch (_) {
        logger.debug(`Trying to load pattern from architecture schema: ${schemaRef}`);
    }
    const pattern = docLoader.loadMissingDocument(schemaRef, 'pattern');
    logger.debug(`Loaded pattern from architecture schema: ${schemaRef}`);
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