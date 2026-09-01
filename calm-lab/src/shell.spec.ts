import { describe, it, expect, vi } from 'vitest';
import { runCommand, completeCommand, CALM_SUBCOMMANDS } from './shell';
import { createVfs } from './lab/vfs';
import { ENGINE_VERSION } from './engine';

const valid = JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'a' }],
    relationships: [],
});
const withB = JSON.stringify({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'a' }, { 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'b' }],
    relationships: [],
});

function context(files: Record<string, string>) {
    const vfs = createVfs(files);
    let cwd = '/workspace';
    const onEvent = vi.fn();
    return { ctx: { vfs, getCwd: () => cwd, setCwd: (dir: string) => { cwd = dir; }, onEvent }, onEvent };
}

describe('calm validate', () => {
    it('prints the pretty report and emits a validate event', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': valid });
        const lines = await runCommand('calm validate a.json', ctx);
        expect(lines[0]).toEqual({ text: '✓ a.json is a valid CALM architecture', kind: 'ok' });
        expect(onEvent).toHaveBeenCalledWith({ type: 'validate', file: '/workspace/a.json', ok: true });
    });

    it('prints the engine pretty report for an invalid document', async () => {
        const { ctx } = context({ '/workspace/bad.json': '{"$schema": "https://calm.finos.org/release/1.2/meta/calm.json", "nodes": "nope"}' });
        const lines = await runCommand('calm validate bad.json', ctx);
        const text = lines.map((l) => l.text);
        expect(text[0]).toMatch(/^bad\.json: \d+ problems? found$/);
        expect(text).toContain('Summary');
        expect(text.some((line) => /^- Errors: yes/.test(line))).toBe(true);
        // The severity label carries the 'err' colour; the rest of the block is dim.
        const errorLines = lines.filter((l) => l.kind === 'err');
        expect(errorLines.length).toBeGreaterThan(0);
        expect(errorLines.every((l) => l.text.trimStart().startsWith('ERROR'))).toBe(true);
    });

    it('reports a JSON parse error on one line', async () => {
        const { ctx } = context({ '/workspace/bad.json': '{ nope' });
        const lines = await runCommand('calm validate bad.json', ctx);
        expect(lines).toHaveLength(1);
        expect(lines[0].kind).toBe('err');
        expect(lines[0].text).toMatch(/^calm validate: .*not valid JSON/);
    });

    it('reports a missing file', async () => {
        const { ctx } = context({});
        expect(await runCommand('calm validate nope.json', ctx)).toEqual([{ text: 'calm validate: file not found: nope.json', kind: 'err' }]);
    });
});

describe('calm diff', () => {
    it('summarises the difference between two files', async () => {
        const { ctx } = context({ '/workspace/a.json': valid, '/workspace/b.json': withB });
        const lines = await runCommand('calm diff a.json b.json', ctx);
        expect(lines.map((l) => l.text).join('\n')).toContain('Nodes added:');
    });

    it('says so when there are no changes', async () => {
        const { ctx } = context({ '/workspace/a.json': valid });
        expect(await runCommand('calm diff a.json a.json', ctx)).toEqual([{ text: 'no changes between a.json and a.json', kind: 'ok' }]);
    });

    it('needs two files', async () => {
        const { ctx } = context({});
        expect(await runCommand('calm diff a.json', ctx)).toEqual([{ text: 'usage: calm diff <file-a> <file-b>', kind: 'err' }]);
    });

    it('reports a JSON parse error naming the file', async () => {
        const { ctx } = context({ '/workspace/a.json': '{ nope', '/workspace/b.json': valid });
        const [line] = await runCommand('calm diff a.json b.json', ctx);
        expect(line.kind).toBe('err');
        expect(line.text).toMatch(/^calm diff: a\.json is not valid JSON/);
    });
});

describe('other calm commands', () => {
    it('explains unsupported commands from the manifest', async () => {
        const { ctx } = context({});
        const [line] = await runCommand('calm docify', ctx);
        expect(line.kind).toBe('dim');
        expect(line.text).toMatch(/^`calm docify` isn't available in the browser lab: /);
        expect(line.text).toContain('https://calm.finos.org/working-with-calm/cli');
    });

    it('finds the manifest reason for a hub subcommand', async () => {
        const { ctx } = context({});
        const [line] = await runCommand('calm hub pull', ctx);
        expect(line.kind).toBe('dim');
        expect(line.text).toMatch(/^`calm hub pull` isn't available in the browser lab: /);
        expect(line.text).toContain('CORS');
    });

    it('lists the hub subcommands and their reasons for a bare `calm hub`', async () => {
        const { ctx } = context({});
        const lines = await runCommand('calm hub', ctx);
        const text = lines.map((l) => l.text);
        expect(text[0]).toBe('`calm hub` needs a subcommand:');
        expect(text.some((line) => /^ {2}calm hub pull — .*CORS/.test(line))).toBe(true);
        expect(text.some((line) => /^ {2}calm hub push — /.test(line))).toBe(true);
        expect(text[text.length - 1]).toContain('https://calm.finos.org/working-with-calm/cli');
    });

    it('rejects unknown subcommands', async () => {
        const { ctx } = context({});
        expect((await runCommand('calm frobnicate', ctx))[0].text).toMatch(/unknown command/);
    });

    it('prints the engine version', async () => {
        const { ctx } = context({});
        expect((await runCommand('calm --version', ctx))[0].text).toBe(`browser lab · @finos/calm-shared ${ENGINE_VERSION}`);
    });

    it('completes calm subcommands', () => {
        const { ctx } = context({});
        expect(CALM_SUBCOMMANDS).toContain('diff');
        expect(completeCommand('calm d', 6, ctx)).toEqual({ value: 'calm diff ', caret: 10 });
    });
});

describe('builtins', () => {
    it('ls, cat, cd, pwd, echo, clear still work', async () => {
        const { ctx } = context({ '/workspace/a.json': valid, '/workspace/dir/b.json': '{}' });
        expect((await runCommand('ls', ctx)).map((l) => l.text)).toEqual(['dir/', 'a.json']);
        expect((await runCommand('cat a.json', ctx))[0].text).toBe(valid);
        await runCommand('cd dir', ctx);
        expect((await runCommand('pwd', ctx))[0].text).toBe('/workspace/dir');
        expect((await runCommand('echo hi', ctx))[0]).toEqual({ text: 'hi', kind: 'out' });
        expect((await runCommand('clear', ctx))[0].kind).toBe('clear');
    });
});
