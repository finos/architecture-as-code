import path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId, readJson, writeJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-workspace';
const api = hubApi();

const A_MAPPING = 'svc-arch';
const B_MAPPING = 'system-arch';
const aId = (v: string) => hubDocId(NS, 'architectures', A_MAPPING, v);
const bId = (v: string) => hubDocId(NS, 'architectures', B_MAPPING, v);

describe('Flow 3: workspace check -> bump -> push', () => {
    let cli: CliInstall;
    let wsDir: string;
    let aFile: string;
    let bFile: string;

    async function run(args: string[]) {
        return cli.run(args, { cwd: wsDir });
    }

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-workspace');
        wsDir = path.join(cli.tempDir, 'repo');
        fs.mkdirSync(wsDir, { recursive: true });
        execSync('git init', { cwd: wsDir, stdio: 'inherit' });

        aFile = path.join(wsDir, 'svc-arch.architecture.json');
        bFile = path.join(wsDir, 'system-arch.architecture.json');
        writeJson(aFile, {
            $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
            $id: aId('1.0.0'),
            title: A_MAPPING,
            nodes: [{ 'unique-id': 'svc-a', 'node-type': 'service', name: 'Service A', description: 'initial' }],
            relationships: [],
        });
        // B references A via $ref — the only reference form recognised by the ref-rewrite
        // cascade engine (REFERENCE_PROPERTIES = ['$ref', '$schema', 'requirement-url', 'config-url']).
        // The CALM 'detailed-architecture' field is not in that list, so a cascade would not fire
        // if used instead.
        writeJson(bFile, {
            $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
            $id: bId('1.0.0'),
            title: B_MAPPING,
            nodes: [{ 'unique-id': 'system', 'node-type': 'system', name: 'System', description: 'System architecture', '$ref': aId('1.0.0') }],
            relationships: [],
        });

        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke workspace', '-c', SMOKE_HUB_URL]);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('workspace init creates .calm-workspace', async () => {
        await run(['workspace', 'init', 'smoke-ws']);
        expect(fs.existsSync(path.join(wsDir, '.calm-workspace'))).toBe(true);
    });

    test('workspace add registers both documents', async () => {
        await run(['workspace', 'add', aFile, '--id', aId('1.0.0'), '--type', 'architecture', '--namespace', NS]);
        await run(['workspace', 'add', bFile, '--id', bId('1.0.0'), '--type', 'architecture', '--namespace', NS]);
        // The CLI logger routes info/warn/error to stderr (stderrLevels includes 'info').
        const { stderr } = await run(['workspace', 'list']);
        expect(stderr).toContain('smoke-ws');
    });

    test('workspace push publishes both at 1.0.0', async () => {
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, 'architectures', A_MAPPING)).toContain('1.0.0');
        expect(await api.listVersions(NS, 'architectures', B_MAPPING)).toContain('1.0.0');
    });

    test('workspace check is clean immediately after push', async () => {
        const result = await run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(result.exitCode).toBe(0);
    });

    test('workspace check fails after an on-disk edit', async () => {
        const a = readJson(aFile);
        (a.nodes as { description: string }[])[0].description = 'edited on disk';
        writeJson(aFile, a);
        await expect(run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL])).rejects.toHaveProperty('exitCode', 1);
    });

    test('workspace push --fail-if-modified fails on the drifted doc without a new version', async () => {
        const before = await api.listVersions(NS, 'architectures', A_MAPPING);
        await expect(
            run(['workspace', 'push', '--fail-if-modified', '--calm-hub-url', SMOKE_HUB_URL])
        ).rejects.toHaveProperty('exitCode', 1);
        expect(await api.listVersions(NS, 'architectures', A_MAPPING)).toEqual(before);
    });

    test('workspace bump increments A to 1.1.0 and repoints B to it (cascade)', async () => {
        await run(['workspace', 'bump', '--minor', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(readJson(aFile).$id).toBe(aId('1.1.0'));
        // B's reference to A must now point at A@1.1.0.
        expect(JSON.stringify(readJson(bFile))).toContain(aId('1.1.0'));
        expect(readJson(bFile).$id).toBe(bId('1.1.0'));
    });

    test('workspace push publishes the bumped versions and check is clean again', async () => {
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, 'architectures', A_MAPPING)).toContain('1.1.0');
        // B changed via cascade, so it is also bumped and published.
        expect(await api.listVersions(NS, 'architectures', B_MAPPING)).toContain('1.1.0');
        const result = await run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(result.exitCode).toBe(0);
    });

    // End-to-end guard that workspace validation actually resolves the document's `$schema` and
    // validates against it (architecture-with-pattern mode). If validation regressed to
    // architecture-only, a document that violates its schema would slip through `workspace check`.
    test('workspace check fails and reports a validation error when a document violates its schema', async () => {
        const a = readJson(aFile);
        // `nodes` must be an array per the CALM core schema referenced by this doc's `$schema`;
        // making it a string is a schema violation that only pattern/schema validation can catch.
        a.nodes = 'not-an-array';
        writeJson(aFile, a);

        const err = await run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL]).catch(e => e);
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('failed validation');
    });
});

// CalmHub rejects a $id whose base URL is not its calm.hub.base-url. Before #3838, check reported
// such a document as needing a bump, and bump then gave it a version that push could not publish.
describe('Flow 3b: workspace commands reject a $id base URL mismatch', () => {
    const BASE_NS = 'smoke-workspace-base-url';
    const MAPPING = 'base-url-arch';
    const WRONG_BASE = 'http://127.0.0.1:8080';
    const id = (v: string, base?: string) => hubDocId(BASE_NS, 'architectures', MAPPING, v, base);

    let cli: CliInstall;
    let wsDir: string;
    let file: string;

    const run = (args: string[]) => cli.run(args, { cwd: wsDir });
    const fail = (args: string[]) => run(args).then(
        () => { throw new Error(`expected 'calm ${args.join(' ')}' to fail`); },
        e => e
    );

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-workspace-base-url');
        wsDir = path.join(cli.tempDir, 'repo');
        fs.mkdirSync(wsDir, { recursive: true });
        execSync('git init', { cwd: wsDir, stdio: 'inherit' });

        file = path.join(wsDir, `${MAPPING}.architecture.json`);
        writeJson(file, {
            $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
            $id: id('1.0.0'),
            title: MAPPING,
            nodes: [{ 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: 'initial' }],
            relationships: [],
        });

        await cli.run(['hub', 'create', 'namespace', '--name', BASE_NS, '--description', 'smoke workspace base url', '-c', SMOKE_HUB_URL]);
        await run(['workspace', 'init', 'smoke-ws-base-url']);
        await run(['workspace', 'add', file, '--id', id('1.0.0'), '--type', 'architecture', '--namespace', BASE_NS]);
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(await api.listVersions(BASE_NS, 'architectures', MAPPING)).toEqual(['1.0.0']);

        const doc = readJson(file);
        doc.$id = id('1.0.0', WRONG_BASE);
        writeJson(file, doc);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('check fails on the mismatch and does not report it as needing a bump', async () => {
        const err = await fail(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain(`$id base URL '${WRONG_BASE}' does not match CalmHub base URL '${SMOKE_HUB_URL}'`);
        expect(err.stderr).not.toContain('changed on disk but not bumped');
    });

    test('bump fails and does not change the document', async () => {
        const before = fs.readFileSync(file, 'utf8');
        const err = await fail(['workspace', 'bump', '--minor', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('does not match CalmHub base URL');
        expect(fs.readFileSync(file, 'utf8')).toBe(before);
    });

    test('push fails without sending the document', async () => {
        const err = await fail(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain('does not match CalmHub base URL');
        expect(await api.listVersions(BASE_NS, 'architectures', MAPPING)).toEqual(['1.0.0']);
    });

    // Guards the CLI check against CalmHub itself: with the CLI check satisfied, CalmHub still rejects.
    test('CalmHub rejects the document when --base-url matches it instead of CalmHub', async () => {
        const doc = readJson(file);
        doc.$id = id('1.1.0', WRONG_BASE);
        writeJson(file, doc);
        const err = await fail(['workspace', 'push', '--base-url', WRONG_BASE, '--calm-hub-url', SMOKE_HUB_URL]);
        expect(err.exitCode).toBe(1);
        expect(err.stderr).not.toContain('does not match CalmHub base URL');
        expect(await api.listVersions(BASE_NS, 'architectures', MAPPING)).toEqual(['1.0.0']);
    });
});
