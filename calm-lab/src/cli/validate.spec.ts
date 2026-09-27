import { describe, it, expect, vi } from 'vitest';
import { runValidate } from './validate';
import { createVfs } from '../lab/vfs';
import PATTERN from './fixtures/web-app-pattern.json?raw';
import GENERATED from './fixtures/generated-webapp.json?raw';
import BROKEN from './fixtures/broken-webapp.json?raw';
import OK from './fixtures/ok.json?raw';
import OWNED_PATTERN from './fixtures/owned-pattern.json?raw';
import OWNED_NODE from './fixtures/owned-node.json?raw';
import UNOWNED from './fixtures/unowned.json?raw';

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
    const vfs = createVfs(files, null);
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
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            command: 'validate', files: { architecture: '/workspace/a.json' }, ok: true, warningCount: 1, snapshot: { '/workspace/a.json': A },
        }) });
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
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            command: 'validate', files: { architecture: '/workspace/bad.json' }, ok: false,
        }) });
    });

    it('resolves the path from the cwd and reports the resolved file', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A }, '/workspace/sub');
        await runValidate(['-a', '../a.json'], ctx);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            command: 'validate', files: { architecture: '/workspace/a.json' }, ok: true,
        }) });
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

    it.each([
        ['-a', 'https://example.com/a.json'],
        ['--architecture', 'https://example.com/a.json'],
        ['-a', 'urn:example:architecture'],
        ['-a', 'calm:/namespaces/x/architectures/1'],
    ])('says %s %s is not supported in the lab yet', async (flag, reference) => {
        const { ctx } = context({});
        expect(await runValidate([flag, reference], ctx)).toEqual([{
            text: "The browser lab doesn't support `--architecture <url>` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli",
            kind: 'dim',
        }]);
    });

    it('reports invalid JSON as the CLI does', async () => {
        const { ctx } = context({ '/workspace/broken.json': '{ nope' });
        const lines = await runValidate(['-a', 'broken.json'], ctx);
        expect(lines[1].text).toMatch(/^error \[calm-validate\]: {4}An error occurred while validating: \/workspace\/broken\.json is not valid JSON: /);
    });

    it('says -f junit is not supported in the lab yet', async () => {
        const { ctx, onEvent } = context({ '/workspace/a.json': A });
        const [line] = await runValidate(['-a', 'a.json', '-f', 'junit'], ctx);
        expect(line.text).toBe("The browser lab doesn't support `--format junit` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli");
        expect(onEvent).not.toHaveBeenCalled();
    });
});

// Pinned from the real CLI: sandbox/pr12/reference.md "validate -p" and "validate -u".
describe('calm validate -p', () => {
    const P = '/workspace/patterns/web-app-pattern.json';
    const files = {
        [P]: PATTERN,
        '/workspace/architectures/generated-webapp.json': GENERATED,
        '/workspace/architectures/broken-webapp.json': BROKEN,
        '/workspace/architectures/ok.json': OK,
    };
    const run = async (args: string[], cwd?: string) => {
        const { ctx, onEvent } = context(files, cwd);
        return { lines: await runValidate(args, ctx), onEvent };
    };

    it('passes an architecture that matches the pattern', async () => {
        const { lines, onEvent } = await run(['-p', 'patterns/web-app-pattern.json', '-a', 'architectures/ok.json', '-f', 'pretty']);
        expect(text(lines)).toBe(['Summary', '- Errors: no (0)', '- Warnings: no (0)', '- Info/Hints: 0', '', 'No issues found.'].join('\n'));
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: {
            command: 'validate',
            files: { architecture: '/workspace/architectures/ok.json', pattern: P },
            ok: true,
            errorCount: 0,
            warningCount: 0,
            snapshot: { '/workspace/architectures/ok.json': OK, [P]: PATTERN },
        } });
    });

    it('warns about the placeholders in a generated architecture', async () => {
        const { lines } = await run(['-p', 'patterns/web-app-pattern.json', '-a', 'architectures/generated-webapp.json', '-f', 'pretty']);
        const G = '/workspace/architectures/generated-webapp.json';
        expect(text(lines)).toBe([
            'Summary', '- Errors: no (0)', '- Warnings: yes (3)', '- Info/Hints: 0', '',
            'WARN  issues:',
            `- In generated-webapp.json (${G}):`,
            ...[['web-frontend', 7], ['api-service', 13], ['app-database', 19]].flatMap(([id, line]) => [
                '  WARN architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.',
                `    path: /nodes/${id}/description`,
                `    at line ${line}, col 22 (${G})`,
                `    ${line} |       "description": "[[ DESCRIPTION ]]"`,
                `    ${' '.repeat(String(line).length)} |                      ^^^^^^^^^^^^^^^^^^^`,
            ]),
        ].join('\n'));
    });

    it('fails an architecture that breaks the pattern, with the CLI report', async () => {
        const { lines, onEvent } = await run(['-p', 'patterns/web-app-pattern.json', '-a', 'architectures/broken-webapp.json', '-f', 'pretty']);
        const B = '/workspace/architectures/broken-webapp.json';
        const report = text(lines).split('\n');
        expect(report.slice(0, 4)).toEqual(['Summary', '- Errors: yes (3)', '- Warnings: yes (4)', '- Info/Hints: 0']);
        expect(report.slice(5, 18)).toEqual([
            'ERROR issues:',
            `- In broken-webapp.json (${B}):`,
            '  ERROR json-schema: must be equal to constant (expected "api-service")',
            '    path: /nodes/backend-api/unique-id',
            `    at line 10, col 20 (${B})`,
            '    schema: #/properties/nodes/prefixItems/1/properties/unique-id/const',
            '    10 |       "unique-id": "backend-api",',
            '       |                    ^^^^^^^^^^^^^',
            "  ERROR connects-relationship-references-existing-nodes-in-architecture: 'api-service' does not refer to the unique-id of an existing node.",
            '    path: /relationships/frontend-to-api/relationship-type/connects/destination/node',
            `    at line 31, col 21 (${B})`,
            '    31 |             "node": "api-service"',
            '       |                     ^^^^^^^^^^^^^',
        ]);
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({ ok: false, errorCount: 3, warningCount: 4 }) });
    });

    it('validates a pattern on its own', async () => {
        const { lines, onEvent } = await run(['-p', 'patterns/web-app-pattern.json']);
        expect(text(lines)).toBe(JSON.stringify({
            jsonSchemaValidationOutputs: [], spectralSchemaValidationOutputs: [], hasErrors: false, hasWarnings: false,
        }, null, 4));
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            files: { pattern: P }, ok: true, snapshot: { [P]: PATTERN },
        }) });
    });

    it('reports a missing pattern as the CLI does', async () => {
        const { lines, onEvent } = await run(['-p', 'missing.json', '-a', 'architectures/ok.json']);
        expect(lines).toEqual([
            { text: 'error [multi-strategy-document-loader]:    Loader FileSystemDocumentLoader failed fatally loading document: missing.json. Enable debug logging for the full loader report.', kind: 'err' },
            { text: "error [calm-validate]:    An error occurred while validating: ENOENT: no such file or directory, open '/workspace/missing.json'", kind: 'err' },
        ]);
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('loads the architecture before the pattern, as the CLI does', async () => {
        const { lines } = await run(['-p', 'missing.json', '-a', 'nope.json']);
        expect(lines[0].text).toContain('loading document: nope.json.');
    });

    it('reports a pattern that is not JSON as the CLI does', async () => {
        const { ctx } = context({ ...files, '/workspace/patterns/broken.json': '{ "nodes": [\n' });
        const lines = await runValidate(['-p', 'patterns/broken.json', '-a', 'architectures/ok.json'], ctx);
        expect(lines[1].text).toBe('error [calm-validate]:    An error occurred while validating: /workspace/patterns/broken.json is not valid JSON: Unexpected end of JSON input');
    });

    it('says -p <url> is not supported in the lab yet', async () => {
        const { lines } = await run(['-p', 'https://example.com/p.json', '-a', 'architectures/ok.json']);
        expect(lines).toEqual([{
            text: "The browser lab doesn't support `--pattern <url>` for `calm validate` yet. Use the CLI — https://calm.finos.org/working-with-calm/cli",
            kind: 'dim',
        }]);
    });
});

describe('calm validate -u', () => {
    const MAPPING = '{\n  "https://example.com/standards/owned-node.json": "standards/owned-node.json"\n}\n';
    const NESTED = '{\n  "https://example.com/standards/owned-node.json": "../standards/owned-node.json"\n}\n';
    const files = {
        '/workspace/patterns/owned-pattern.json': OWNED_PATTERN,
        '/workspace/standards/owned-node.json': OWNED_NODE,
        '/workspace/architectures/unowned.json': UNOWNED,
        '/workspace/url-mapping.json': MAPPING,
        '/workspace/config/url-mapping.json': NESTED,
    };
    const OWNER_ERROR = "  ERROR json-schema: must have required property 'owner'";
    const run = async (args: string[], extra: Record<string, string> = {}) => {
        const { ctx, onEvent } = context({ ...files, ...extra });
        return { report: text(await runValidate(args, ctx)), onEvent };
    };
    const args = (mapping: string) => ['-p', 'patterns/owned-pattern.json', '-a', 'architectures/unowned.json', '-u', mapping, '-f', 'pretty'];

    it('loads a mapped URL from the workspace', async () => {
        const { report, onEvent } = await run(args('url-mapping.json'));
        expect(report).toContain(OWNER_ERROR);
        expect(report).toContain('    schema: https://example.com/standards/owned-node.json/required');
        expect(report).toContain('- Errors: yes (2)');
        expect(onEvent).toHaveBeenCalledWith({ type: 'command', outcome: expect.objectContaining({
            files: {
                architecture: '/workspace/architectures/unowned.json',
                pattern: '/workspace/patterns/owned-pattern.json',
                mapping: '/workspace/url-mapping.json',
            },
            snapshot: {
                '/workspace/architectures/unowned.json': UNOWNED,
                '/workspace/patterns/owned-pattern.json': OWNED_PATTERN,
                '/workspace/url-mapping.json': MAPPING,
                '/workspace/standards/owned-node.json': OWNED_NODE,
            },
        }) });
    });

    it("resolves mapped paths against the mapping file's directory, not the cwd", async () => {
        expect((await run(args('config/url-mapping.json'))).report).toContain(OWNER_ERROR);
    });

    it('does not load the URL without a mapping', async () => {
        const { report } = await run(['-p', 'patterns/owned-pattern.json', '-a', 'architectures/unowned.json', '-f', 'pretty']);
        expect(report).not.toContain(OWNER_ERROR);
        expect(report).toContain('https://example.com/standards/owned-node.json');
    });

    it('reports a missing mapping file as the CLI does', async () => {
        const { report, onEvent } = await run(args('missing-map.json'));
        expect(report).toBe("Error reading url to local file mapping file: missing-map.json Error: ENOENT: no such file or directory, open 'missing-map.json'");
        expect(onEvent).not.toHaveBeenCalled();
    });

    it('reports a mapping file that is not JSON as the CLI does', async () => {
        const { report } = await run(args('patterns/broken.json'), { '/workspace/patterns/broken.json': '{ "nodes": [\n' });
        expect(report).toBe('Error reading url to local file mapping file: patterns/broken.json SyntaxError: Unexpected end of JSON input');
    });

    it('reports a missing mapped file as the CLI does', async () => {
        const { report } = await run(args('map.json'), { '/workspace/map.json': '{"https://example.com/standards/owned-node.json": "standards/nope.json"}' });
        expect(report.split('\n')[0]).toBe('warn [mapped-document-loader]:     Mapped file does not exist: /workspace/standards/nope.json (mapped from https://example.com/standards/owned-node.json)');
        expect(report).toContain('  ERROR json-schema: File not found: /workspace/standards/nope.json');
    });

    it('reports a mapped file that is not JSON as the CLI does', async () => {
        const { report } = await run(args('map.json'), {
            '/workspace/map.json': '{"https://example.com/standards/owned-node.json": "patterns/broken.json"}',
            '/workspace/patterns/broken.json': '{ "nodes": [\n',
        });
        const message = 'Failed to load/parse /workspace/patterns/broken.json: Unexpected end of JSON input';
        expect(report.split('\n')[0]).toBe(`warn [mapped-document-loader]:     Failed to pre-load https://example.com/standards/owned-node.json: ${message}`);
        expect(report).toContain(`  ERROR json-schema: ${message}`);
    });
});
