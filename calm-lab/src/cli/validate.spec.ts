import { describe, it, expect, vi } from 'vitest';
import { runValidate } from './validate';
import { createVfs } from '../lab/vfs';

const A = `{
    "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
    "nodes": [
        { "unique-id": "a", "node-type": "service", "name": "A", "description": "a" }
    ],
    "relationships": []
}
`;
const BAD = '{"$schema": "https://calm.finos.org/release/1.2/meta/calm.json", "nodes": "nope", "relationships": []}';

function context(files: Record<string, string>, cwd = '/workspace') {
    const vfs = createVfs(files);
    const onEvent = vi.fn();
    return { ctx: { vfs, getCwd: () => cwd, setCwd: () => undefined, onEvent }, onEvent };
}
const text = (lines: { text: string }[]) => lines.map((line) => line.text).join('\n');

describe('calm validate', () => {
    it('prints the outcome as JSON by default, with document positions', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A });
        const output = JSON.parse(text(await runValidate(['-a', 'a.json'], ctx)));
        expect(output.hasErrors).toBe(false);
        expect(output.spectralSchemaValidationOutputs[0]).toMatchObject({
            code: 'architecture-nodes-must-be-referenced',
            line_start: 4,
            character_start: 23,
            source: 'architecture',
        });
        expect(onEvent).toHaveBeenCalledWith({ type: 'validate', file: '/workspace/a.json', ok: true });
    });

    it('prints the pretty report the CLI prints', async () => {
        const { ctx } = context({ '/workspace/a.json': A });
        const lines = text(await runValidate(['-a', 'a.json', '-f', 'pretty'], ctx)).split('\n');
        expect(lines.slice(0, 4)).toEqual(['Summary', '- Errors: no (0)', '- Warnings: yes (1)', '- Info/Hints: 0']);
        expect(lines).toContain('- In a.json (/workspace/a.json):');
        expect(lines).toContain('    at line 4, col 24 (/workspace/a.json)');
    });

    it('reports errors with ok=false and colours ERROR lines', async () => {
        const { ctx, onEvent } = context({ '/workspace/bad.json': BAD });
        const lines = await runValidate(['-a', 'bad.json', '-f', 'pretty'], ctx);
        expect(text(lines)).toContain('  ERROR json-schema: must be array');
        expect(lines.filter((line) => line.kind === 'err').every((line) => line.text.trimStart().startsWith('ERROR'))).toBe(true);
        expect(onEvent).toHaveBeenCalledWith({ type: 'validate', file: '/workspace/bad.json', ok: false });
    });

    it('resolves the path from the cwd and reports the resolved file', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A }, '/workspace/sub');
        await runValidate(['-a', '../a.json'], ctx);
        expect(onEvent).toHaveBeenCalledWith({ type: 'validate', file: '/workspace/a.json', ok: true });
    });

    it('rejects the old positional form like the CLI', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A });
        expect(await runValidate(['a.json'], ctx)).toEqual([
            { text: "error: too many arguments for 'validate'. Expected 0 arguments but got 1.", kind: 'err' },
        ]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('needs -a, -p or --timeline', async () => {
        const { ctx } = context({});
        expect(await runValidate([], ctx)).toEqual([{
            text: "error: one of the required options '-p, --pattern <file>', '-a, --architecture <file>' or '--timeline <file>' was not specified",
            kind: 'err',
        }]);
    });

    it('rejects --timeline with -a like the CLI', async () => {
        const { ctx } = context({});
        expect(await runValidate(['-a', 'a.json', '--timeline', 't.json'], ctx)).toEqual([{
            text: "error: the option '--timeline <file>' cannot be used with either of the options '-p, --pattern <file>' or '-a, --architecture <file>'",
            kind: 'err',
        }]);
    });

    it('reports a missing file as the CLI does', async () => {
        const { ctx, onEvent } = context({});
        expect(await runValidate(['-a', 'nope.json'], ctx)).toEqual([
            { text: 'error [multi-strategy-document-loader]:    Loader FileSystemDocumentLoader failed fatally loading document: nope.json. Enable debug logging for the full loader report.', kind: 'err' },
            { text: "error [calm-validate]:    An error occurred while validating: ENOENT: no such file or directory, open '/workspace/nope.json'", kind: 'err' },
        ]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('reports a directory as the CLI does', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A });
        expect(await runValidate(['-a', '.'], ctx)).toEqual([
            { text: 'error [multi-strategy-document-loader]:    Loader FileSystemDocumentLoader failed fatally loading document: .. Enable debug logging for the full loader report.', kind: 'err' },
            { text: 'error [calm-validate]:    An error occurred while validating: EISDIR: illegal operation on a directory, read', kind: 'err' },
        ]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it.each([['-a'], ['--architecture']])('says %s <url> is not supported in the lab yet', async (flag) => {
        const { ctx } = context({});
        expect(await runValidate([flag, 'https://example.com/a.json'], ctx)).toEqual([{
            text: "The browser lab doesn't support `--architecture <url>` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli",
            kind: 'dim',
        }]);
    });

    it('reports invalid JSON as the CLI does', async () => {
        const { ctx } = context({ '/workspace/broken.json': '{ nope' });
        const lines = await runValidate(['-a', 'broken.json'], ctx);
        expect(lines[1].text).toMatch(/^error \[calm-validate\]: {4}An error occurred while validating: \/workspace\/broken\.json is not valid JSON: /);
    });

    it('says -p is not supported in the lab yet', async () => {
        const { ctx } = context({ '/workspace/a.json': A });
        const [line] = await runValidate(['-p', 'p.json', '-a', 'a.json'], ctx);
        expect(line.kind).toBe('dim');
        expect(line.text).toBe("The browser lab doesn't support `--pattern` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli");
    });

    it('says -f junit is not supported in the lab yet', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A });
        const [line] = await runValidate(['-a', 'a.json', '-f', 'junit'], ctx);
        expect(line.text).toBe("The browser lab doesn't support `--format junit` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli");
        expect(onEvent).not.toHaveBeenCalled();
    });
});
