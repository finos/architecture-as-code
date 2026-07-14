import path from 'path';
import * as fs from 'fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId, readJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-genval';
const PATTERN_FIXTURE = path.resolve(__dirname, 'fixtures/genval/conference-signup.pattern.json');
const PATTERN_URL = hubDocId(NS, 'patterns', 'conference-signup', '1.0.0');
const api = hubApi();

describe('Flow 2: generate/validate (local + CalmHub refs)', () => {
    let cli: CliInstall;

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-genval');
        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke genval', '-c', SMOKE_HUB_URL]);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('generate from a local pattern produces an architecture', async () => {
        const out = path.join(cli.tempDir, 'local-arch.json');
        await cli.run(['generate', '-p', PATTERN_FIXTURE, '-o', out]);
        expect(fs.existsSync(out)).toBe(true);
        const nodes = readJson(out).nodes as unknown[];
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBeGreaterThan(0);
    });

    test('validate a local architecture against the local pattern passes', async () => {
        const arch = path.join(cli.tempDir, 'local-arch.json');
        expect(fs.existsSync(arch)).toBe(true);
        const { stdout } = await cli.run(['validate', '-p', PATTERN_FIXTURE, '-a', arch, '-f', 'json']);
        expect(JSON.parse(stdout).hasErrors).toBe(false);
    });

    test('the pattern can be pushed to and served from the hub', async () => {
        await cli.run(['hub', 'push', 'pattern', PATTERN_FIXTURE, '--name', 'conference-signup', '-c', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, 'patterns', 'conference-signup')).toContain('1.0.0');
    });

    test('generate from a CalmHub-hosted pattern URL produces an architecture', async () => {
        const out = path.join(cli.tempDir, 'hub-arch.json');
        await cli.run(['generate', '-p', PATTERN_URL, '-o', out, '-c', SMOKE_HUB_URL]);
        expect(fs.existsSync(out)).toBe(true);
        const nodes = readJson(out).nodes as unknown[];
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBeGreaterThan(0);
    });

    test('validate against a CalmHub-hosted pattern URL passes', async () => {
        const arch = path.join(cli.tempDir, 'hub-arch.json');
        expect(fs.existsSync(arch)).toBe(true);
        const { stdout } = await cli.run(['validate', '-p', PATTERN_URL, '-a', arch, '-f', 'json', '-c', SMOKE_HUB_URL]);
        expect(JSON.parse(stdout).hasErrors).toBe(false);
    });
});
