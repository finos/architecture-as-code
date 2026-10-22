import path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubDocId, readJson, writeJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-direct-url-auth';
const plainId = (v: string) => hubDocId(NS, 'architectures', 'plain-arch', v);
const protectedId = (v: string) => hubDocId(NS, 'architectures', 'protected-arch', v);

// The module file does not exist, so every load fails. Only the protected architecture has its
// `$schema` on the authenticated host.
describe('workspace check and bump with a direct URL auth module that cannot load', () => {
    let cli: CliInstall;
    let wsDir: string;
    let plainFile: string;

    async function run(args: string[]) {
        return cli.run(args, {
            cwd: wsDir,
            env: {
                CALM_DIRECT_URL_AUTH_MODULE: path.join(cli.tempDir, 'missing-direct-url-auth.js'),
                CALM_DIRECT_URL_AUTH_AUTHENTICATED_HOSTS: 'protected.example.com',
            },
        });
    }

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-direct-url-auth');
        wsDir = path.join(cli.tempDir, 'repo');
        fs.mkdirSync(wsDir, { recursive: true });
        execSync('git init', { cwd: wsDir, stdio: 'inherit' });

        plainFile = path.join(wsDir, 'plain.architecture.json');
        const protectedFile = path.join(wsDir, 'protected.architecture.json');
        writeJson(plainFile, {
            $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
            $id: plainId('1.0.0'),
            title: 'plain-arch',
            nodes: [{ 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: 'initial' }],
            relationships: [],
        });
        writeJson(protectedFile, {
            $schema: 'https://protected.example.com/patterns/protected.pattern.json',
            $id: protectedId('1.0.0'),
            title: 'protected-arch',
            nodes: [],
            relationships: [],
        });

        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke direct URL auth', '-c', SMOKE_HUB_URL]);
        await run(['workspace', 'init', 'direct-url-auth-ws']);
        await run(['workspace', 'add', plainFile, '--id', plainId('1.0.0'), '--type', 'architecture', '--namespace', NS]);
        await run(['workspace', 'add', protectedFile, '--id', protectedId('1.0.0'), '--type', 'architecture', '--namespace', NS]);
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);

        const plain = readJson(plainFile);
        (plain.nodes as { description: string }[])[0].description = 'edited on disk';
        writeJson(plainFile, plain);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('workspace check runs, and fails validation only for the document on the authenticated host', async () => {
        const err = await run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL]).catch(e => e);

        expect(err.exitCode).toBe(1);
        expect(err.stderr).toContain(`${plainId('1.0.0')} (current version 1.0.0)`);
        expect(err.stderr).toContain('1 document(s) failed validation:');
        expect(err.stderr).toContain(`${protectedId('1.0.0')} (could not validate)`);
        expect(err.stderr).toContain('direct URL auth module file not found');
    });

    test('workspace bump writes the bump, and only warns about the document on the authenticated host', async () => {
        const { stderr } = await run(['workspace', 'bump', '--minor', '--calm-hub-url', SMOKE_HUB_URL]);

        expect(readJson(plainFile).$id).toBe(plainId('1.1.0'));
        expect(stderr).toContain('1 document(s) failed validation after bump:');
        expect(stderr).toContain(`${protectedId('1.0.0')} (could not validate)`);
    });
});
