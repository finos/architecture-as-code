import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, ValidationFormattingOptions, ValidationOutcome, loadArchitectureAndPattern, enrichWithDocumentPositions, ParsedDocumentContext } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { readFileSync, writeFileSync } from 'fs';
import { Command } from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader, DocumentLoader } from '@finos/calm-shared/dist/document-loader/document-loader';
import { Logger } from '@finos/calm-shared/dist/logger';
import { parseWithPointers } from '@stoplight/json';

export interface ValidateOptions {
    patternPath?: string;
    architecturePath?: string;
    metaSchemaPath: string;
    calmHubUrl?: string;
    urlToLocalFileMapping?: string;
    verbose: boolean;
    strict: boolean;
    outputFormat: ValidateOutputFormat;
    outputPath: string;
}

export async function runValidate(options: ValidateOptions) {
    const logger = initLogger(options.verbose, 'calm-validate');
    try {
        const { getUrlToLocalFileMap } = await import('./template');
        const urlToLocalMap = getUrlToLocalFileMap(options.urlToLocalFileMapping);
        const patternBasePath = options.patternPath ? path.dirname(path.resolve(options.patternPath)) : undefined;
        const docLoaderOpts = await parseDocumentLoaderConfig(options, urlToLocalMap, patternBasePath);
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
        const documentContexts = buildDocumentContexts(options, logger);
        const outcome = await validate(architecture, pattern, schemaDirectory, options.verbose);
        enrichWithDocumentPositions(outcome, documentContexts);
        const content = getFormattedOutput(outcome, options.outputFormat, toFormattingOptions(documentContexts));
        writeOutputFile(options.outputPath, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
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

interface LoadedDocumentContext extends ParsedDocumentContext {
    filePath: string;
    lines: string[];
}

function buildDocumentContexts(options: ValidateOptions, logger: Logger): Record<string, LoadedDocumentContext> {
    const contexts: Record<string, LoadedDocumentContext> = {};

    if (options.architecturePath) {
        const context = loadDocumentContext(options.architecturePath, 'architecture', logger);
        if (context) {
            contexts['architecture'] = context;
        }
    }

    if (options.patternPath) {
        const context = loadDocumentContext(options.patternPath, 'pattern', logger);
        if (context) {
            contexts['pattern'] = context;
        }
    }

    return contexts;
}

function loadDocumentContext(filePath: string, id: string, logger: Logger): LoadedDocumentContext | undefined {
    try {
        const absolutePath = path.resolve(filePath);
        const raw = readFileSync(absolutePath, 'utf-8');
        const parsed = parseWithPointers(raw);
        return {
            id,
            filePath: absolutePath,
            lines: raw.split(/\r?\n/),
            data: parsed.data,
            parseResult: parsed
        };
    } catch (error) {
        logger.debug(`Could not build document context for ${filePath}: ${error}`);
        return undefined;
    }
}

function toFormattingOptions(contexts: Record<string, LoadedDocumentContext>): ValidationFormattingOptions {
    const documents: Record<string, { id: string; label: string; filePath: string; lines: string[] }> = {};
    Object.entries(contexts).forEach(([id, ctx]) => {
        documents[id] = {
            id: ctx.id,
            label: path.basename(ctx.filePath),
            filePath: ctx.filePath,
            lines: ctx.lines
        };
    });

    return { documents };
}