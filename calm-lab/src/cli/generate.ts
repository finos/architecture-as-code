import { extractOptions } from '@finos/calm-shared/browser';
import { generateArchitecture, schemaDirectoryWith } from '../engine';
import type { Line, ShellContext } from '../shell';
import { loaderFailureLines, readJsonFile, readUrlMapping, refLoaders } from './files';
import { helpFor } from './help';
import { logLine } from './log';
import { parseArgs } from './options';
import { CLI_DOCS, isUrl, unsupportedInLab } from './unsupported';

const err = (text: string): Line => ({ text, kind: 'err' });
const info = (message: string): Line => ({ text: logLine('info', 'calm-generate', message), kind: 'dim' });

function hasOptions(pattern: object): boolean {
    try {
        return extractOptions(pattern).length > 0;
    } catch {
        // extractOptions walks the pattern unguarded; a malformed one has no options to choose.
        return false;
    }
}

/** cli/src/cli.ts generate action, then shared runGenerate. */
export async function runGenerate(args: string[], ctx: ShellContext): Promise<Line[]> {
    const parsed = parseArgs('generate', args);
    if (parsed.kind === 'help') {
        return helpFor('generate');
    }
    if (parsed.kind === 'error') {
        return parsed.message.split('\n').map(err);
    }
    const { values, given } = parsed;
    const unsupported = given.find((spec) => !spec.supported);
    if (unsupported) {
        return [unsupportedInLab('generate', unsupported.long)];
    }
    const reference = values.pattern as string;
    const outputReference = values.output as string;
    if (isUrl(reference)) {
        return [unsupportedInLab('generate', '--pattern <url>')];
    }

    const mapping = values.urlToLocalFileMapping ? readUrlMapping(ctx, values.urlToLocalFileMapping as string) : undefined;
    if (mapping && 'error' in mapping) {
        return [mapping.error];
    }
    const pattern = readJsonFile(ctx, reference);
    if ('error' in pattern) {
        // The CLI lets this error reach its top-level handler: console.error('\n' + message).
        return [
            err(logLine('error', 'multi-strategy-document-loader', `Loader FileSystemDocumentLoader failed fatally loading document: ${reference}. Enable debug logging for the full loader report.`)),
            err(''),
            err(pattern.error),
        ];
    }
    if (hasOptions(pattern.doc)) {
        // The CLI asks the learner to choose in an interactive prompt the lab terminal cannot show.
        return [{
            text: `The browser lab can't ask you to choose this pattern's options, and doesn't support \`--option-choices\` for \`calm generate\` yet. Use the CLI — ${CLI_DOCS}`,
            kind: 'dim',
        }];
    }

    const lines: Line[] = [
        { text: logLine('info', 'calm-generate-options', 'Selected choices (reusable with --option-choices): {}'), kind: 'dim' },
        info('Generating a CALM architecture...'),
        // The CLI loads the schemas twice, so it prints these twice.
        ...(mapping?.warnings ?? []),
        ...(mapping?.warnings ?? []),
    ];
    const output = ctx.vfs.resolve(ctx.getCwd(), outputReference);
    const files: Record<string, string> = { pattern: pattern.path, output };
    if (mapping) {
        files.mapping = mapping.path;
    }
    const emit = (ok: boolean) => ctx.onEvent?.({
        type: 'command',
        outcome: { command: 'generate', files, ok, errorCount: ok ? 0 : 1, warningCount: 0, snapshot: { [pattern.path]: pattern.content, ...mapping?.snapshot } },
    });
    const failure = (message: string) => logLine('error', 'calm-generate', `Error while generating architecture from pattern: ${message}`).split('\n').map(err);

    // `ok` is "the command wrote an architecture": a generate error and an unwritable output both fail.
    let architecture: object;
    const refs = refLoaders(mapping);
    try {
        architecture = await generateArchitecture(pattern.doc, await schemaDirectoryWith(refs.first, refs.last));
    } catch (error) {
        emit(false);
        return [...lines, ...loaderFailureLines(refs.failures), ...failure(error instanceof Error ? error.message : String(error))];
    }
    if (ctx.vfs.isDir(output)) {
        emit(false);
        return [...lines, ...failure(`EISDIR: illegal operation on a directory, open '${outputReference}'`)];
    }
    ctx.vfs.write(output, JSON.stringify(architecture, null, 2));
    emit(true);
    return [...lines, info(`Successfully generated architecture to [${outputReference}]`)];
}
