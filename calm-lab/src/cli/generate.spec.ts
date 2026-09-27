import { describe, it, expect, vi } from 'vitest';
import { runGenerate } from './generate';
import { createVfs } from '../lab/vfs';
import PATTERN from './fixtures/web-app-pattern.json?raw';
import GENERATED from './fixtures/generated-webapp.json?raw';
import OPTIONS_PATTERN from './fixtures/options-pattern.json?raw';

// Pinned from the real CLI: sandbox/pr12/reference.md "generate".
const P = '/workspace/patterns/web-app-pattern.json';
const SELECTED = { text: 'info [calm-generate-options]:     Selected choices (reusable with --option-choices): {}', kind: 'dim' };
const GENERATING = { text: 'info [calm-generate]:     Generating a CALM architecture...', kind: 'dim' };
const success = (output: string) => ({ text: `info [calm-generate]:     Successfully generated architecture to [${output}]`, kind: 'dim' });
const loadFailure = (reference: string, message: string) => [
    { text: `error [multi-strategy-document-loader]:    Loader FileSystemDocumentLoader failed fatally loading document: ${reference}. Enable debug logging for the full loader report.`, kind: 'err' },
    { text: '', kind: 'err' },
    { text: message, kind: 'err' },
];

function context(files: Record<string, string>, cwd = '/workspace') {
    const vfs = createVfs(files, null);
    const onEvent = vi.fn();
    return { vfs, ctx: { vfs, getCwd: () => cwd, setCwd: () => undefined, onEvent }, onEvent };
}

describe('calm generate', () => {
    it('writes the architecture the CLI writes, and prints its log lines', async () => {
        const { vfs, ctx, onEvent } = context({ [P]: PATTERN });
        const lines = await runGenerate(['-p', 'patterns/web-app-pattern.json', '-o', 'architectures/generated-webapp.json'], ctx);
        expect(lines).toEqual([SELECTED, GENERATING, success('architectures/generated-webapp.json')]);
        expect(vfs.read('/workspace/architectures/generated-webapp.json')).toBe(GENERATED);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: {
            command: 'generate',
            files: { pattern: P, output: '/workspace/architectures/generated-webapp.json' },
            ok: true,
            errorCount: 0,
            warningCount: 0,
            snapshot: { [P]: PATTERN },
        } });
    });

    it('overwrites an existing file without a warning', async () => {
        const { vfs, ctx } = context({ [P]: PATTERN, '/workspace/out.json': '{"old": true}' });
        expect(await runGenerate(['-p', P, '-o', 'out.json'], ctx)).toEqual([SELECTED, GENERATING, success('out.json')]);
        expect(vfs.read('/workspace/out.json')).toBe(GENERATED);
    });

    it('writes architecture.json when -o is not given, resolving from the cwd', async () => {
        const { vfs, ctx } = context({ [P]: PATTERN }, '/workspace/patterns');
        expect(await runGenerate(['-p', 'web-app-pattern.json'], ctx)).toEqual([SELECTED, GENERATING, success('architecture.json')]);
        expect(vfs.read('/workspace/patterns/architecture.json')).toBe(GENERATED);
    });

    it.each([
        [[]],
        [['-o', 'x.json']],
        [['--bogus']],
        [['a.json']],
    ])('needs -p before any other check, like commander: %j', async (args) => {
        const { ctx, onEvent } = context({});
        expect(await runGenerate(args, ctx)).toEqual([{ text: "error: required option '-p, --pattern <file>' not specified", kind: 'err' }]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it.each([
        [['-p', 'p.json', 'a.json'], "error: too many arguments for 'generate'. Expected 0 arguments but got 1."],
        [['-p', 'p.json', '--bogus'], "error: unknown option '--bogus'"],
        [['-p'], "error: option '-p, --pattern <file>' argument missing"],
        [['-p', 'p.json', '-o'], "error: option '-o, --output <file>' argument missing"],
    ])('rejects %j like the CLI', async (args, message) => {
        const { ctx } = context({});
        expect(await runGenerate(args, ctx)).toEqual([{ text: message, kind: 'err' }]);
    });

    it('reports a missing pattern as the CLI does', async () => {
        const { ctx, onEvent } = context({});
        expect(await runGenerate(['-p', 'missing.json'], ctx)).toEqual(
            loadFailure('missing.json', "ENOENT: no such file or directory, open '/workspace/missing.json'"));
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('reports a pattern that is not JSON as the CLI does', async () => {
        const { ctx } = context({ '/workspace/patterns/broken.json': '{ "nodes": [\n' });
        expect(await runGenerate(['-p', 'patterns/broken.json'], ctx)).toEqual(
            loadFailure('patterns/broken.json', '/workspace/patterns/broken.json is not valid JSON: Unexpected end of JSON input'));
    });

    it('reports a directory as the CLI does', async () => {
        const { ctx } = context({ [P]: PATTERN });
        expect(await runGenerate(['-p', 'patterns'], ctx)).toEqual(
            loadFailure('patterns', 'EISDIR: illegal operation on a directory, read'));
    });

    it('reports an output directory as the CLI does, and writes nothing', async () => {
        const { vfs, ctx, onEvent } = context({ [P]: PATTERN });
        expect(await runGenerate(['-p', P, '-o', 'patterns'], ctx)).toEqual([
            SELECTED,
            GENERATING,
            { text: "error [calm-generate]:    Error while generating architecture from pattern: EISDIR: illegal operation on a directory, open 'patterns'", kind: 'err' },
        ]);
        expect(vfs.exists('/workspace/patterns')).toBe(false);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({ command: 'generate', ok: false, errorCount: 1 }) });
    });

    it('counts one error when generate() fails', async () => {
        const REF = '{"properties": {"nodes": {"type": "array", "prefixItems": [{"$ref": "https://example.com/node.json"}]}}}';
        const { vfs, ctx, onEvent } = context({ '/workspace/p.json': REF });
        const lines = await runGenerate(['-p', 'p.json', '-o', 'out.json'], ctx);
        expect(lines.at(-1)).toMatchObject({ text: expect.stringContaining('Error while generating architecture from pattern: '), kind: 'err' });
        expect(vfs.exists('/workspace/out.json')).toBe(false);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({ command: 'generate', ok: false, errorCount: 1 }) });
    });

    it('does not prompt for pattern options, and says the CLI can', async () => {
        const { vfs, ctx, onEvent } = context({ '/workspace/p.json': OPTIONS_PATTERN });
        expect(await runGenerate(['-p', 'p.json', '-o', 'out.json'], ctx)).toEqual([{
            text: "The browser lab can't ask you to choose this pattern's options, and doesn't support `--option-choices` for `calm generate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli",
            kind: 'dim',
        }]);
        expect(vfs.exists('/workspace/out.json')).toBe(false);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it.each([
        [['--option-choices', '{}'], '--option-choices'],
        [['-s', 'schemas'], '--schema-directory'],
        [['-c', 'https://hub'], '--calm-hub-url'],
        [['-v'], '--verbose'],
    ])('says %j is not supported in the lab yet', async (extra, long) => {
        const { ctx, onEvent } = context({ [P]: PATTERN });
        expect(await runGenerate(['-p', P, ...extra], ctx)).toEqual([{
            text: `The browser lab doesn't support \`${long}\` for \`calm generate\` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli`,
            kind: 'dim',
        }]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('says -p <url> is not supported in the lab yet', async () => {
        const { ctx } = context({});
        expect(await runGenerate(['-p', 'https://example.com/p.json'], ctx)).toEqual([{
            text: "The browser lab doesn't support `--pattern <url>` for `calm generate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli",
            kind: 'dim',
        }]);
    });

    it('reads -u like validate, and records the mapping in the outcome', async () => {
        const MAP = '{"https://example.com/standards/x.json": "x.json"}';
        const X = '{"$id": "https://example.com/standards/x.json"}';
        const { ctx, onEvent } = context({ [P]: PATTERN, '/workspace/map.json': MAP, '/workspace/x.json': X });
        expect(await runGenerate(['-p', P, '-o', 'out.json', '-u', 'map.json'], ctx)).toEqual([SELECTED, GENERATING, success('out.json')]);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            files: { pattern: P, output: '/workspace/out.json', mapping: '/workspace/map.json' },
            snapshot: { [P]: PATTERN, '/workspace/map.json': MAP, '/workspace/x.json': X },
        }) });
    });

    it('reports a missing mapping file as the CLI does', async () => {
        const { ctx } = context({ [P]: PATTERN });
        expect(await runGenerate(['-p', P, '-u', 'missing-map.json'], ctx)).toEqual([{
            text: "Error reading url to local file mapping file: missing-map.json Error: ENOENT: no such file or directory, open 'missing-map.json'",
            kind: 'err',
        }]);
    });

    it('warns twice about a missing mapped file after the Generating line, as the CLI does', async () => {
        const { ctx } = context({ [P]: PATTERN, '/workspace/map.json': '{"https://example.com/x.json": "nope.json"}' });
        const warning = { text: 'warn [mapped-document-loader]:     Mapped file does not exist: /workspace/nope.json (mapped from https://example.com/x.json)', kind: 'dim' };
        expect(await runGenerate(['-p', P, '-o', 'out.json', '-u', 'map.json'], ctx)).toEqual([SELECTED, GENERATING, warning, warning, success('out.json')]);
    });
});
