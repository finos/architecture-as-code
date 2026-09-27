import { describe, it, expect, vi } from 'vitest';
import { runCommand, completeCommand, CALM_SUBCOMMANDS } from './shell';
import { createVfs } from './lab/vfs';
import { CLI_VERSION } from './engine';

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

    it.each(['calm hub', 'calm hub --help', 'calm hub -h'])('lists the hub subcommands and their reasons for `%s`', async (input) => {
        const { ctx } = context({});
        const lines = await runCommand(input, ctx);
        const text = lines.map((l) => l.text);
        expect(text[0]).toBe('`calm hub` needs a subcommand:');
        expect(text.some((line) => /^ {2}calm hub pull — .*CORS/.test(line))).toBe(true);
        expect(text.some((line) => /^ {2}calm hub push — /.test(line))).toBe(true);
        expect(text[text.length - 1]).toContain('https://calm.finos.org/working-with-calm/cli');
    });

    it.each([
        ['calm valdate', ["error: unknown command 'valdate'", '(Did you mean validate?)']],
        ['calm hlep', ["error: unknown command 'hlep'", '(Did you mean help?)']],
        ['calm dif', ["error: unknown command 'dif'", '(Did you mean diff?)']],
        ['calm genrate', ["error: unknown command 'genrate'", '(Did you mean generate?)']],
        ['calm xyz', ["error: unknown command 'xyz'"]],
        ['calm valdate --bogus', ["error: unknown command 'valdate'", '(Did you mean validate?)']],
        ['calm hub pul', ["error: unknown command 'pul'", '(Did you mean pull?)']],
        ['calm hub frob', ["error: unknown command 'frob'"]],
        ['calm hub --bogus', ["error: unknown option '--bogus'"]],
        ['calm hub --hlep', ["error: unknown option '--hlep'", '(Did you mean --help?)']],
        ['calm hub -x', ["error: unknown option '-x'"]],
        ['calm --bogus', ["error: unknown option '--bogus'"]],
        ['calm --versio', ["error: unknown option '--versio'", '(Did you mean --version?)']],
    ])('%s is rejected like the CLI', async (input, expected) => {
        const { ctx } = context({});
        expect(await runCommand(input, ctx)).toEqual(expected.map((text) => ({ text, kind: 'err' })));
    });

    it('prints the CLI version like `calm --version`', async () => {
        const { ctx } = context({});
        expect(await runCommand('calm --version', ctx)).toEqual([{ text: CLI_VERSION, kind: 'out' }]);
        expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });

    it.each([
        'calm validate --version',
        'calm validate -a a.json -V',
        'calm diff --version',
        'calm validate -a -V',
        'calm validate -f xml -V',
        'calm validate -h -V',
        'calm valdate -V',
        'calm help -V',
        'calm -Vx',
    ])('%s prints the version, as commander honours -V anywhere', async (input) => {
        const { ctx } = context({});
        expect(await runCommand(input, ctx)).toEqual([{ text: CLI_VERSION, kind: 'out' }]);
    });

    it('treats -V after -- as an argument', async () => {
        const { ctx } = context({});
        expect(await runCommand('calm validate -- -V', ctx)).toEqual([
            { text: "error: too many arguments for 'validate'. Expected 0 arguments but got 1.", kind: 'err' },
        ]);
    });

    it('rejects -v like the CLI', async () => {
        const { ctx } = context({});
        expect(await runCommand('calm -v', ctx)).toEqual([{ text: "error: unknown option '-v'", kind: 'err' }]);
    });

    it.each(['calm help', 'calm --help', 'calm -h', 'calm help nope', 'calm valdate -h', 'calm --bogus --help', 'calm -z -- -h'])('%s prints the lab help', async (input) => {
        const { ctx } = context({});
        expect((await runCommand(input, ctx))[0].text).toBe('calm in the browser lab — the commands it runs:');
    });

    it.each([
        ['calm validate --help', 'validate'],
        ['calm help validate', 'validate'],
        ['calm diff -h', 'diff'],
        ['calm help diff', 'diff'],
    ])('%s prints the lab help for the command', async (input, command) => {
        const { ctx } = context({});
        expect((await runCommand(input, ctx))[0].text).toBe(`calm ${command} in the browser lab — the options it supports:`);
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
