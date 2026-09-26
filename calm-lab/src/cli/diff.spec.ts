import { describe, it, expect, vi } from 'vitest';
import { runDiff } from './diff';
import { createVfs } from '../lab/vfs';

const doc = (ids: string[]) => JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: ids.map((id) => ({ 'unique-id': id, 'node-type': 'service', name: id, description: id })),
    relationships: [],
});
function context(files: Record<string, string>) {
    const vfs = createVfs(files);
    return { vfs, getCwd: () => '/workspace', setCwd: () => undefined };
}
const files = { '/workspace/a.json': doc(['a']), '/workspace/b.json': doc(['a', 'b']) };

describe('calm diff', () => {
    it('logs the comparison and prints JSON by default', async () => {
        const [info, ...rest] = await runDiff(['-a', 'a.json', '-b', 'b.json'], context(files));
        expect(info).toEqual({ text: 'info [calm-diff]:     Comparing a.json -> b.json', kind: 'dim' });
        expect(JSON.parse(rest.map((line) => line.text).join('\n')).nodesAdded[0]['unique-id']).toBe('b');
    });

    it('prints the summary format', async () => {
        const lines = (await runDiff(['-a', 'a.json', '-b', 'b.json', '-f', 'summary'], context(files))).map((line) => line.text);
        expect(lines.slice(1)).toEqual([
            'CALM architecture diff',
            '----------------------',
            'Nodes:         +1  -0  ~0  ↔0  =1',
            'Relationships: +0  -0  ~0  ↔0  =0',
            '',
            'Nodes added:',
            '  - b',
        ]);
    });

    it('prints the zero-change table rather than a lab message', async () => {
        const lines = (await runDiff(['-a', 'a.json', '-b', 'a.json', '-f', 'summary'], context(files))).map((line) => line.text);
        expect(lines).toContain('Nodes:         +0  -0  ~0  ↔0  =1');
    });

    it.each([
        [[], 'error: both -a/--document-a <file> and -b/--document-b <file> are required'],
        [['-a', 'a.json'], 'error: both -a/--document-a <file> and -b/--document-b <file> are required'],
        [['a.json', 'b.json'], "error: too many arguments for 'diff'. Expected 0 arguments but got 2."],
        [['-a', 'a.json', '-b', 'b.json', '--from', 'x'], 'error: --from/--to are only valid together with --timeline'],
        [['--timeline', 't.json', '-a', 'a.json'], 'error: --timeline cannot be combined with -a/--document-a or -b/--document-b'],
        [['--timeline', 't.json', '--from', 'x'], 'error: --from and --to must be supplied together'],
    ])('rejects %j like the CLI', async (args, message) => {
        expect(await runDiff(args, context(files))).toEqual([{ text: message, kind: 'err' }]);
    });

    it('reports a missing file as the CLI does', async () => {
        expect(await runDiff(['-a', 'nope.json', '-b', 'a.json'], context(files))).toEqual([
            { text: 'info [calm-diff]:     Comparing nope.json -> a.json', kind: 'dim' },
            { text: "error [calm-diff]:    An error occurred while diffing CALM documents: ENOENT: no such file or directory, open '/workspace/nope.json'", kind: 'err' },
        ]);
    });

    it('reports a JSON parse error with the raw parser message', async () => {
        const lines = await runDiff(['-a', 'broken.json', '-b', 'a.json'], context({ ...files, '/workspace/broken.json': '{ nope' }));
        expect(lines[1].text).toMatch(/^error \[calm-diff\]: {4}An error occurred while diffing CALM documents: Expected property name/);
    });

    it.each([
        [['-a', '.', '-b', 'a.json'], 'Comparing . -> a.json'],
        [['-a', 'a.json', '-b', '.'], 'Comparing a.json -> .'],
    ])('reports a directory as the CLI does for %j', async (args, comparing) => {
        expect(await runDiff(args, context(files))).toEqual([
            { text: `info [calm-diff]:     ${comparing}`, kind: 'dim' },
            { text: 'error [calm-diff]:    An error occurred while diffing CALM documents: EISDIR: illegal operation on a directory, read', kind: 'err' },
        ]);
    });

    it.each([
        [['-a', 'https://example.com/a.json', '-b', 'b.json'], '--document-a <url>'],
        [['-a', 'a.json', '--document-b', 'http://example.com/b.json'], '--document-b <url>'],
        [['--architecture-a', 'a.json', '--architecture-b', 'b.json'], '--architecture-a'],
    ])('says %j is not in the lab yet', async (args, what) => {
        expect(await runDiff(args, context(files))).toEqual([
            { text: `The browser lab doesn't support \`${what}\` for \`calm diff\` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli`, kind: 'dim' },
        ]);
    });

    it('says unsupported options are not in the lab yet', async () => {
        const [line] = await runDiff(['-a', 'a.json', '-b', 'b.json', '--exit-code'], context(files));
        expect(line.text).toBe("The browser lab doesn't support `--exit-code` for `calm diff` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli");
    });

    it('emits a diff outcome with both resolved files', async () => {
        const ctx = { ...context(files), onEvent: vi.fn() };
        await runDiff(['-a', 'a.json', '-b', 'b.json'], ctx);
        expect(ctx.onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            command: 'diff', ok: true, files: { documentA: '/workspace/a.json', documentB: '/workspace/b.json' },
        }) });
    });

    it('emits a failed diff outcome when both files were read but one is not valid JSON', async () => {
        const ctx = { ...context({ ...files, '/workspace/broken.json': '{ nope' }), onEvent: vi.fn() };
        await runDiff(['-a', 'a.json', '-b', 'broken.json'], ctx);
        expect(ctx.onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            command: 'diff', ok: false, files: { documentA: '/workspace/a.json', documentB: '/workspace/broken.json' },
        }) });
    });
});
