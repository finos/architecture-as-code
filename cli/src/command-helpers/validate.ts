import { getFormattedOutput, validate, exitBasedOffOfValidationOutcome, SchemaDirectory, ValidationFormattingOptions, ValidationOutcome } from '@finos/calm-shared';
import { initLogger } from '@finos/calm-shared';
import path from 'path';
import { mkdirp } from 'mkdirp';
import { readFileSync, writeFileSync } from 'fs';
import { Command } from 'commander';
import { ValidateOutputFormat } from '@finos/calm-shared/dist/commands/validate/validate';
import { buildSchemaDirectory, parseDocumentLoaderConfig } from '../cli';
import { buildDocumentLoader, DocumentLoader, CALM_HUB_PROTO } from '@finos/calm-shared/dist/document-loader/document-loader';
import { Logger } from '@finos/calm-shared/dist/logger';
import { parse as parseJsonWithPointers } from 'json-source-map';

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
    // If it's an absolute URL (http, https, file) or calm: protocol, use as-is
    if (schemaRef.startsWith('http://') || schemaRef.startsWith('https://') || schemaRef.startsWith('file://') || schemaRef.startsWith(CALM_HUB_PROTO)) {
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

type JsonPointerPosition = { line: number; column: number };
type JsonPointerInfo = { value?: JsonPointerPosition; valueEnd?: JsonPointerPosition };
type JsonPointerMap = Record<string, JsonPointerInfo>;

interface LoadedDocumentContext {
    id: string;
    filePath: string;
    lines: string[];
    data: unknown;
    pointers: JsonPointerMap;
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
        const parsed = parseJsonWithPointers(raw);
        return {
            id,
            filePath: absolutePath,
            lines: raw.split(/\r?\n/),
            data: parsed.data,
            pointers: parsed.pointers as JsonPointerMap
        };
    } catch (error) {
        logger.debug(`Could not build document context for ${filePath}: ${error}`);
        return undefined;
    }
}

function enrichWithDocumentPositions(outcome: ValidationOutcome, contexts: Record<string, LoadedDocumentContext>): void {
    if (!outcome?.allValidationOutputs) {
        return;
    }
    const outputs = outcome.allValidationOutputs();
    outputs.forEach(output => {
        const source = output.source || inferSourceFromAvailability(contexts);
        const context = source ? contexts[source] : undefined;
        if (!context || !output.path) {
            return;
        }

        const pointerPath = output.path;
        const pointer = context.pointers[pointerPath];
        if (!pointer) {
            return;
        }

        if (pointer.value) {
            if (output.line_start === undefined) {
                output.line_start = pointer.value.line + 1; // store 1-based for user-facing data
            }
            if (output.character_start === undefined) {
                output.character_start = pointer.value.column;
            }
        }
        if (pointer.valueEnd) {
            if (output.line_end === undefined) {
                output.line_end = pointer.valueEnd.line + 1; // store 1-based for user-facing data
            }
            if (output.character_end === undefined) {
                output.character_end = pointer.valueEnd.column;
            }
        }
        output.source = output.source || source;

        const friendlyPath = rewritePathWithIds(pointerPath, context.data);
        if (friendlyPath) {
            output.path = friendlyPath;
        }
    });
}

function inferSourceFromAvailability(contexts: Record<string, LoadedDocumentContext>): string | undefined {
    if (contexts.architecture) {
        return 'architecture';
    }
    if (contexts.pattern) {
        return 'pattern';
    }
    return undefined;
}

function hasProp(obj: unknown, prop: string): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && prop in obj;
}

function rewritePathWithIds(pointerPath: string, data: unknown): string | undefined {
    if (!pointerPath || data === undefined || data === null) {
        return undefined;
    }

    const tokens = pointerPath.split('/').slice(1); // remove leading empty token from JSON pointer
    const rewritten: string[] = [];
    let cursor: unknown = data;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (Array.isArray(cursor)) {
            const index = Number(token);
            const item = cursor[index];
            const id = hasProp(item, 'unique-id') && typeof item['unique-id'] === 'string' ? (item['unique-id'] as string) : token;

            rewritten.push(id);
            cursor = item;
            continue;
        }

        if (hasProp(cursor, token)) {
            rewritten.push(token);
            cursor = cursor[token];
            continue;
        }

        rewritten.push(token);
        cursor = undefined;
    }

    const decorated = rewritten.join('/');
    return `/${decorated}`;
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