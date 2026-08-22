import path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { installPackedCli, type CliInstall } from '../src/test_helpers/cli-runner';
import { SMOKE_HUB_URL } from './global-setup';
import { hubApi } from './harness/hub-api';
import { hubDocId } from './harness/fixtures';

const CLI_ROOT = path.resolve(__dirname, '..');
const NS = 'smoke-workspace-documents';
const api = hubApi();

describe('workspace narrative-document POC', () => {
    let cli: CliInstall;
    let wsDir: string;
    let documentPath: string;
    let architecturePath: string;
    let documentId: number;
    const initial = '---\ntitle: Payments SAD\ndescription: Smoke document\n---\n# Payments\n';

    async function run(args: string[]) {
        return cli.run(args, { cwd: wsDir });
    }

    beforeAll(async () => {
        cli = installPackedCli(CLI_ROOT, 'calm-smoke-workspace-documents');
        wsDir = path.join(cli.tempDir, 'repo');
        fs.mkdirSync(wsDir, { recursive: true });
        execSync('git init', { cwd: wsDir, stdio: 'inherit' });
        documentPath = path.join(wsDir, 'payments-sad.md');
        fs.writeFileSync(documentPath, initial);
        architecturePath = path.join(wsDir, 'payments.architecture.json');
        fs.writeFileSync(architecturePath, JSON.stringify({
            $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
            $id: hubDocId(NS, 'architectures', 'payments', '1.0.0'),
            title: 'Payments', nodes: [], relationships: [],
        }, null, 2));
        await cli.run(['hub', 'create', 'namespace', '--name', NS, '--description', 'workspace documents smoke', '-c', SMOKE_HUB_URL]);
    }, 120_000);

    afterAll(() => cli?.cleanup());

    test('publishes, retrieves, bumps, and republishes a Markdown document', async () => {
        await run(['workspace', 'init', 'documents']);
        await run(['workspace', 'add', architecturePath, '--type', 'architecture', '--namespace', NS]);
        await run(['workspace', 'add', documentPath, '--type', 'sad', '--namespace', NS]);
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(await api.listVersions(NS, 'architectures', 'payments')).toContain('1.0.0');

        const manifestPath = path.join(wsDir, '.calm-workspace', 'bundles', 'documents', 'workspace-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, { calmHubDocumentId: number }>;
        documentId = manifest['Payments SAD'].calmHubDocumentId;
        expect(await api.getNarrativeDocument(NS, 'sad', documentId, '1.0.0')).toBe(initial);

        fs.writeFileSync(documentPath, initial.replace('# Payments', '# Updated payments'));
        await expect(run(['workspace', 'check', '--calm-hub-url', SMOKE_HUB_URL])).rejects.toHaveProperty('exitCode', 1);
        await run(['workspace', 'bump', '--minor', '--calm-hub-url', SMOKE_HUB_URL]);
        await run(['workspace', 'push', '--calm-hub-url', SMOKE_HUB_URL]);
        expect(await api.getNarrativeDocument(NS, 'sad', documentId, '1.1.0')).toContain('# Updated payments');
    });
});
