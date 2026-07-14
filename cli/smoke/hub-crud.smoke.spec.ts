import path from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { canonicalEqual } from '@finos/calm-shared';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId, patchJson, readJson, writeJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-crud';
const TYPE = 'architectures';
const MAPPING = 'smoke-arch';
const api = hubApi();

function architecture(version: string, description: string) {
    return {
        $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
        $id: hubDocId(NS, TYPE, MAPPING, version),
        title: MAPPING,
        nodes: [
            {
                'unique-id': 'svc-a',
                'node-type': 'service',
                name: 'Service A',
                description,
            },
        ],
        relationships: [],
    };
}

describe('Flow 1: hub push/pull/list', () => {
    let cli: CliInstall;
    let archFile: string;

    beforeAll(() => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-crud');
        archFile = path.join(cli.tempDir, 'smoke-arch.architecture.json');
        writeJson(archFile, architecture('1.0.0', 'initial'));
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('create namespace registers it on the hub', async () => {
        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke crud', '-c', SMOKE_HUB_URL]);
        expect(await api.listNamespaces()).toContain(NS);
    });

    test('push architecture publishes version 1.0.0', async () => {
        await cli.run(['hub', 'push', 'architecture', archFile, '-c', SMOKE_HUB_URL]);
        expect(await api.listMappings(NS, TYPE)).toContain(MAPPING);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toContain('1.0.0');
        const stored = await api.getDocument(NS, TYPE, MAPPING, '1.0.0');
        expect(stored.$id).toBe(hubDocId(NS, TYPE, MAPPING, '1.0.0'));
    });

    test('list architectures shows the mapping', async () => {
        const { stdout } = await cli.run(['hub', 'list', 'architectures', '--namespace', NS, '-c', SMOKE_HUB_URL]);
        expect(await api.listMappings(NS, TYPE)).toContain(MAPPING);
        expect(stdout).toContain(MAPPING);
    });

    test('pull architecture writes a file matching the stored document', async () => {
        const out = path.join(cli.tempDir, 'pulled.json');
        await cli.run(['hub', 'pull', 'architecture', '--namespace', NS, '-m', MAPPING, '--ver', '1.0.0', '-o', out, '-c', SMOKE_HUB_URL]);
        const pulled = readJson(out);
        const stored = await api.getDocument(NS, TYPE, MAPPING, '1.0.0');
        expect(canonicalEqual(pulled, stored)).toBe(true);
    });

    test('re-push of a changed doc auto-bumps to 1.0.1 (default patch)', async () => {
        patchJson(archFile, (o) => {
            (o.nodes as { description: string }[])[0].description = 'changed';
        });
        await cli.run(['hub', 'push', 'architecture', archFile, '-c', SMOKE_HUB_URL]);
        const versions = await api.listVersions(NS, TYPE, MAPPING);
        expect(versions).toContain('1.0.0');
        expect(versions).toContain('1.0.1');
        const bumped = await api.getDocument(NS, TYPE, MAPPING, '1.0.1');
        expect((bumped.nodes as { description: string }[])[0].description).toBe('changed');
    });

    test('--fail-if-modified skips an unchanged doc without creating a version', async () => {
        // archFile currently equals the latest published version (1.0.1).
        // Point its $id at the latest so it is byte-compatible, then strict push.
        patchJson(archFile, (o) => {
            o.$id = hubDocId(NS, TYPE, MAPPING, '1.0.1');
        });
        const before = await api.listVersions(NS, TYPE, MAPPING);
        const result = await cli.run(['hub', 'push', 'architecture', archFile, '--fail-if-modified', '-c', SMOKE_HUB_URL]);
        expect(result.exitCode).toBe(0);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(before);
    });

    test('--fail-if-modified fails a changed doc and creates no new version', async () => {
        patchJson(archFile, (o) => {
            (o.nodes as { description: string }[])[0].description = 'changed again';
        });
        const before = await api.listVersions(NS, TYPE, MAPPING);
        await expect(
            cli.run(['hub', 'push', 'architecture', archFile, '--fail-if-modified', '-c', SMOKE_HUB_URL])
        ).rejects.toHaveProperty('exitCode', 1);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(before);
    });
});
