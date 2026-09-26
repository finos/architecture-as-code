import { enrichWithDocumentPositions, formatOutput, parseDocumentWithPositions, type OutputFormat } from '@finos/calm-shared/browser';
import { validateOutcome } from '../engine';
import type { Line, ShellContext } from '../shell';
import { helpFor } from './help';
import { logLine } from './log';
import { parseArgs } from './options';
import { unsupportedInLab } from './unsupported';

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
    if (format === 'junit') {
        return [unsupportedInLab('validate', `--format ${format}`)];
    }

    const reference = values.architecture as string;
    const path = ctx.vfs.resolve(ctx.getCwd(), reference);
    const content = ctx.vfs.read(path);
    if (content === null) {
        return loadFailure(reference, `ENOENT: no such file or directory, open '${path}'`);
    }
    let architecture: object;
    try {
        architecture = JSON.parse(content) as object;
    } catch (error) {
        return loadFailure(reference, `${path} is not valid JSON: ${(error as Error).message}`);
    }

    const outcome = await validateOutcome(architecture);
    const context = parseDocumentWithPositions(content, 'architecture');
    if (context) {
        enrichWithDocumentPositions(outcome, { architecture: context });
    }
    const formatted = formatOutput(outcome, format, {
        documents: {
            architecture: { id: 'architecture', label: path.split('/').pop(), filePath: path, lines: content.split(/\r?\n/) },
        },
    });
    ctx.onEvent?.({ type: 'validate', file: path, ok: !outcome.hasErrors });
    return formatted
        .replace(/\n$/, '')
        .split('\n')
        .map((text): Line => ({ text, kind: format === 'pretty' && text.trimStart().startsWith('ERROR') ? 'err' : 'out' }));
}
