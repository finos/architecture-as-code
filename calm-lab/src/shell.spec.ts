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
    it('dispatches to the CLI-compatible validate', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': valid });
        const lines = await runCommand('calm validate -a a.json -f pretty', ctx);
        expect(lines[0].text).toBe('Summary');
        expect(onEvent).toHaveBeenCalledWith({ type: 'validate', file: '/workspace/a.json', ok: true });
    });
});

describe('calm diff', () => {
    it('dispatches to the CLI-compatible diff', async () => {
        const { ctx } = context({ '/workspace/a.json': valid, '/workspace/b.json': withB });
        const lines = await runCommand('calm diff -a a.json -b b.json -f summary', ctx);
        expect(lines.map((l) => l.text)).toContain('Nodes added:');
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
