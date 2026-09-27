import { diffDocuments, type DiffOutputFormat } from '@finos/calm-shared/browser';
import type { Line, ShellContext } from '../shell';
import { helpFor } from './help';
import { logLine } from './log';
import { parseArgs } from './options';
import { isUrl, readError, unsupportedInLab } from './unsupported';

const err = (text: string): Line => ({ text, kind: 'err' });

export async function runDiff(args: string[], ctx: ShellContext): Promise<Line[]> {
    const parsed = parseArgs('diff', args);
    if (parsed.kind === 'help') {
        return helpFor('diff');
    }
    if (parsed.kind === 'error') {
        return parsed.message.split('\n').map(err);
    }
    const { values, given } = parsed;

    // cli/src/cli.ts diff action, in the same order
    if (values.timeline) {
        if (values.documentA || values.documentB || values.architectureA || values.architectureB) {
            return [err('error: --timeline cannot be combined with -a/--document-a or -b/--document-b')];
        }
        if (Boolean(values.from) !== Boolean(values.to)) {
            return [err('error: --from and --to must be supplied together')];
        }
    } else {
        if (values.from || values.to) {
            return [err('error: --from/--to are only valid together with --timeline')];
        }
        if (!(values.documentA ?? values.architectureA) || !(values.documentB ?? values.architectureB)) {
            return [err('error: both -a/--document-a <file> and -b/--document-b <file> are required')];
        }
    }
    const unsupported = given.find((spec) => !spec.supported);
    if (unsupported) {
        return [unsupportedInLab('diff', unsupported.long)];
    }

    const a = values.documentA as string;
    const b = values.documentB as string;
    const url = [['--document-a', a], ['--document-b', b]].find(([, reference]) => isUrl(reference));
    if (url) {
        return [unsupportedInLab('diff', `${url[0]} <url>`)];
    }
    const lines: Line[] = [{ text: logLine('info', 'calm-diff', `Comparing ${a} -> ${b}`), kind: 'dim' }];
    try {
        const [docA, docB] = [a, b].map((reference) => {
            const path = ctx.vfs.resolve(ctx.getCwd(), reference);
            const content = ctx.vfs.read(path);
            if (content === null) {
                throw new Error(readError(ctx.vfs, path));
            }
            return JSON.parse(content) as Record<string, unknown>;
        });
        const result = diffDocuments(docA, docB, { format: values.format as DiffOutputFormat, labels: [a, b] });
        return [...lines, ...result.formatted.replace(/\n$/, '').split('\n').map((text): Line => ({ text, kind: 'out' }))];
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [...lines, err(logLine('error', 'calm-diff', `An error occurred while diffing CALM documents: ${message}`))];
    }
}
