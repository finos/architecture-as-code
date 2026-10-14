import path from 'path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { canonicalEqual } from '@finos/calm-shared';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId, patchJson, readJson, writeJson } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-flows';
const TYPE = 'flows';
const MAPPING = 'smoke-flow';
const api = hubApi();

// A schema-valid CALM flow: it has `name` and no `title`.
function flow(version: string, description: string) {
    return {
        $schema: 'https://calm.finos.org/release/1.2/meta/flow.json',
        $id: hubDocId(NS, TYPE, MAPPING, version),
        'unique-id': MAPPING,
        name: 'Smoke Flow',
        description,
        transitions: [
            {
                'relationship-unique-id': 'svc-a-calls-svc-b',
                'sequence-number': 1,
                description: 'Service A calls Service B',
            },
        ],
    };
}

describe('Flow 4: hub push/pull/list for flows', () => {
    let cli: CliInstall;
    let flowFile: string;

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-flows');
        flowFile = path.join(cli.tempDir, 'smoke-flow.flow.json');
        writeJson(flowFile, flow('1.0.0', 'initial'));
        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'smoke flows', '-c', SMOKE_HUB_URL]);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('push flow publishes 1.0.0 and keeps it name-only', async () => {
        await cli.run(['hub', 'push', 'flow', flowFile, '-c', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(['1.0.0']);
        const stored = await api.getDocument(NS, TYPE, MAPPING, '1.0.0');
        expect(stored.name).toBe('Smoke Flow');
        expect(stored).not.toHaveProperty('title');
    });

    test('list flows shows the mapping', async () => {
        const { stdout } = await cli.run(['hub', 'list', 'flows', '--namespace', NS, '-c', SMOKE_HUB_URL]);
        expect(stdout).toContain(MAPPING);
    });

    test('pull flow writes a file matching the stored document', async () => {
        const out = path.join(cli.tempDir, 'pulled.flow.json');
        await cli.run(['hub', 'pull', 'flow', '--namespace', NS, '-m', MAPPING, '--ver', '1.0.0', '-o', out, '-c', SMOKE_HUB_URL]);
        const stored = await api.getDocument(NS, TYPE, MAPPING, '1.0.0');
        expect(canonicalEqual(readJson(out), stored)).toBe(true);
    });

    test('--fail-if-modified skips an unchanged flow without creating a version', async () => {
        const result = await cli.run(['hub', 'push', 'flow', flowFile, '--fail-if-modified', '-c', SMOKE_HUB_URL]);
        expect(result.exitCode).toBe(0);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(['1.0.0']);
    });

    test('re-push of a changed flow auto-bumps to 1.0.1', async () => {
        patchJson(flowFile, (o) => {
            o.description = 'changed';
        });
        await cli.run(['hub', 'push', 'flow', flowFile, '-c', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(['1.0.0', '1.0.1']);
        const bumped = await api.getDocument(NS, TYPE, MAPPING, '1.0.1');
        expect(bumped.description).toBe('changed');
        expect(bumped).not.toHaveProperty('title');
    });

    test('--fail-if-modified fails a changed flow and creates no new version', async () => {
        patchJson(flowFile, (o) => {
            o.description = 'changed again';
        });
        await expect(
            cli.run(['hub', 'push', 'flow', flowFile, '--fail-if-modified', '-c', SMOKE_HUB_URL])
        ).rejects.toHaveProperty('exitCode', 1);
        expect(await api.listVersions(NS, TYPE, MAPPING)).toEqual(['1.0.0', '1.0.1']);
    });
});
