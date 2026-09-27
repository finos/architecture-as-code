import {
    enrichWithDocumentPositions,
    formatOutput,
    parseDocumentWithPositions,
    type OutputFormat,
    type ParsedDocumentContext,
    type ValidationDocumentContext,
} from '@finos/calm-shared/browser';
import { schemaDirectoryWith, validateOutcome } from '../engine';
import type { Line, ShellContext } from '../shell';
import { readJsonFile, readUrlMapping, refFailureLines, refLoaders, type ReadFile } from './files';
import { helpFor } from './help';
import { logLine } from './log';
import { parseArgs } from './options';
import { isUrl, unsupportedInLab, VALIDATE_LAB_FORMATS } from './unsupported';

const PATTERN = '-p, --pattern <file>';
const ARCHITECTURE = '-a, --architecture <file>';
const TIMELINE = '--timeline <file>';

const err = (text: string): Line => ({ text, kind: 'err' });

function loadFailure(reference: string, message: string): Line[] {
    return [
        err(logLine('error', 'multi-strategy-document-loader', `Loader FileSystemDocumentLoader failed fatally loading document: ${reference}. Enable debug logging for the full loader report.`)),
        err(logLine('error', 'calm-validate', `An error occurred while validating: ${message}`)),
    ];
}

export async function runValidate(args: string[], ctx: ShellContext): Promise<Line[]> {
    const parsed = parseArgs('validate', args);
    if (parsed.kind === 'help') {
        return helpFor('validate');
    }
    if (parsed.kind === 'error') {
        return parsed.message.split('\n').map(err);
    }
    const { values, given } = parsed;

    // cli/src/command-helpers/validate.ts checkValidateOptions
    if (values.timeline && (values.pattern || values.architecture)) {
        return [err(`error: the option '${TIMELINE}' cannot be used with either of the options '${PATTERN}' or '${ARCHITECTURE}'`)];
    }
    if (!values.pattern && !values.architecture && !values.timeline) {
        return [err(`error: one of the required options '${PATTERN}', '${ARCHITECTURE}' or '${TIMELINE}' was not specified`)];
    }

    const unsupported = given.find((spec) => !spec.supported);
    if (unsupported) {
        return [unsupportedInLab('validate', unsupported.long)];
    }
    const format = values.format as OutputFormat;
    if (!VALIDATE_LAB_FORMATS.includes(format)) {
        return [unsupportedInLab('validate', `--format ${format}`)];
    }

    const references = { architecture: values.architecture as string | undefined, pattern: values.pattern as string | undefined };
    const url = (['architecture', 'pattern'] as const).find((key) => references[key] && isUrl(references[key]));
    if (url) {
        return [unsupportedInLab('validate', `--${url} <url>`)];
    }

    const mapping = values.urlToLocalFileMapping ? readUrlMapping(ctx, values.urlToLocalFileMapping as string) : undefined;
    if (mapping && 'error' in mapping) {
        return [mapping.error];
    }
    const lines: Line[] = [...(mapping?.warnings ?? [])];

    // loadArchitectureAndPattern: the architecture first, then the pattern.
    const read: Partial<Record<'architecture' | 'pattern', ReadFile>> = {};
    for (const key of ['architecture', 'pattern'] as const) {
        const reference = references[key];
        if (!reference) {
            continue;
        }
        const file = readJsonFile(ctx, reference);
        if ('error' in file) {
            return [...lines, ...loadFailure(reference, file.error)];
        }
        read[key] = file;
    }

    // A pattern's `$ref`s need their own directory, to report the loads that fail; `-a` alone keeps the session one.
    const refs = read.pattern || mapping ? refLoaders(mapping) : undefined;
    const directory = refs ? await schemaDirectoryWith(refs.first, refs.last) : undefined;
    const outcome = await validateOutcome(read.architecture?.doc, read.pattern?.doc, directory);
    lines.push(...refFailureLines(refs?.failures ?? [], Boolean(read.architecture && read.pattern)));
    const documents: Record<string, ValidationDocumentContext> = {};
    const positions: Record<string, ParsedDocumentContext> = {};
    for (const [id, file] of Object.entries(read)) {
        const context = parseDocumentWithPositions(file.content, id);
        if (context) {
            positions[id] = context;
        }
        documents[id] = { id, label: file.path.split('/').pop(), filePath: file.path, lines: file.content.split(/\r?\n/) };
    }
    enrichWithDocumentPositions(outcome, positions);
    const formatted = formatOutput(outcome, format, { documents });

    const files: Record<string, string> = {};
    const snapshot: Record<string, string | null> = {};
    for (const [id, file] of Object.entries(read)) {
        files[id] = file.path;
        snapshot[file.path] = file.content;
    }
    if (mapping) {
        files.mapping = mapping.path;
        Object.assign(snapshot, mapping.snapshot);
    }
    const outputs = [...outcome.jsonSchemaValidationOutputs, ...outcome.spectralSchemaValidationOutputs];
    ctx.onEvent?.({
        type: 'command',
        outcome: {
            command: 'validate',
            files,
            ok: !outcome.hasErrors,
            errorCount: outputs.filter((output) => output.severity === 'error').length,
            warningCount: outputs.filter((output) => output.severity === 'warning').length,
            snapshot,
        },
    });
    return [
        ...lines,
        ...formatted
            .replace(/\n$/, '')
            .split('\n')
            .map((text): Line => ({ text, kind: format === 'pretty' && text.trimStart().startsWith('ERROR') ? 'err' : 'out' })),
    ];
}
