import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, ValidationFormattingOptions, loadArchitectureAndPattern, loadTimeline, enrichWithDocumentPositions, ParsedDocumentContext, initLogger, ValidateOutputFormat, buildDocumentLoader, DocumentLoader, Logger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { readFileSync, writeFileSync } from 'fs';
import { Command } from 'commander';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { parseWithPointers } from '@stoplight/json';

export interface ValidateOptions {
    patternPath?: string;
    architecturePath?: string;
    timelinePath?: string;
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

        let architecture: object | undefined = undefined;
        let pattern: object | undefined = undefined;
        let timeline: object | undefined = undefined;

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
                options.architecturePath ?? '',
                options.patternPath ?? '',
                docLoader,
                schemaDirectory,
                logger
            );
            architecture = result.architecture;
            pattern = result.pattern;
        }
        const documentContexts = buildDocumentContexts(options, logger);
        if (!architecture && !pattern && !timeline) {
            throw new Error('You must provide an architecture, a pattern, or a timeline');
        }
        const outcome = await validate(architecture, pattern, timeline, schemaDirectory, options.verbose);
        enrichWithDocumentPositions(outcome, documentContexts);
        const content = getFormattedOutput(outcome, options.outputFormat, toFormattingOptions(documentContexts));
        writeOutputFile(options.outputPath, content);
        exitBasedOffOfValidationOutcome(outcome, options.strict);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logger.error('An error occurred while validating: ' + message);
        if (stack) logger.debug(stack);
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
export function checkValidateOptions(program: Command, options: any, patternOption: string, architectureOption: string, timelineOption: string) {
    if (options.timeline && (options.pattern || options.architecture)) {
        program.error(`error: the option '${timelineOption}' cannot be used with either of the options '${patternOption}' or '${architectureOption}'`);
    }
    if (!options.pattern && !options.architecture && !options.timeline) {
        program.error(`error: one of the required options '${patternOption}', '${architectureOption}' or '${timelineOption}' was not specified`);
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