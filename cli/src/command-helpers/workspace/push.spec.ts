import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { pushWorkspaceToHub } from './push';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, HubClientError } from '@finos/calm-shared/src/hub/calm-hub-client';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const makeClient = (overrides: Partial<Pick<CalmHubClient, 'getResource' | 'createResource' | 'updateResource'>> = {}): CalmHubClient => ({
    getResource: vi.fn(),
    createResource: vi.fn(async () => '/calm/namespaces/com.example/doc/versions/1.0.0'),
    updateResource: vi.fn(async () => '/calm/namespaces/com.example/doc/versions/1.1.0'),
    ...overrides,
}) as CalmHubClient;

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('pushWorkspaceToHub', () => {
    const testDir = path.join(__dirname, 'test-push');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');

    const docA = { $id: 'doc-a', title: 'Doc A', version: '1.0.0' };
    const docB = { $id: 'doc-b', title: 'Doc B', version: '1.0.0' };

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        if (existsSync(bundlePath)) {
            await rm(bundlePath, { recursive: true, force: true });
        }
        await mkdir(filesPath, { recursive: true });
    });

    it('warns and returns early when manifest is empty', async () => {
        await saveManifest(bundlePath, {});
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getResource).not.toHaveBeenCalled();
        expect(client.createResource).not.toHaveBeenCalled();
    });

    it('skips entries that have no namespace', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getResource).not.toHaveBeenCalled();
    });

    it('skips entries whose file does not exist', async () => {
        await saveManifest(bundlePath, {
            'missing': { path: 'files/missing.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getResource).not.toHaveBeenCalled();
    });

    it('skips entries whose file is invalid JSON', async () => {
        await writeFile(path.join(filesPath, 'bad.json'), 'not json {{{');
        await saveManifest(bundlePath, {
            'bad': { path: 'files/bad.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getResource).not.toHaveBeenCalled();
    });

    it('creates a resource when CalmHub returns 404 and saves the Location URL to the manifest', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const locationUrl = '/calm/namespaces/com.example/doc-a/versions/1.0.0';
        const client = makeClient({
            getResource: vi.fn().mockRejectedValue(new HubClientError(404, 'Not Found', 'GET /calm/namespaces/com.example/doc-a')),
            createResource: vi.fn().mockResolvedValue(locationUrl),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createResource).toHaveBeenCalledWith(
            'com.example', 'doc-a', 'architecture', docA
        );
        expect(client.updateResource).not.toHaveBeenCalled();

        const manifest = await loadManifest(bundlePath);
        expect(manifest['doc-a'].calmHubId).toBe(locationUrl);
    });

    it('skips update when local and remote content are identical', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient({
            getResource: vi.fn().mockResolvedValue(docA),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.updateResource).not.toHaveBeenCalled();
        expect(client.createResource).not.toHaveBeenCalled();
    });

    it('updates when local and remote content differ and saves the new Location URL to the manifest', async () => {
        const localDoc = { ...docA, version: '2.0.0' };
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(localDoc));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const locationUrl = '/calm/namespaces/com.example/doc-a/versions/1.1.0';
        const client = makeClient({
            getResource: vi.fn().mockResolvedValue(docA),
            updateResource: vi.fn().mockResolvedValue(locationUrl),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.updateResource).toHaveBeenCalledWith('com.example', 'doc-a', localDoc);
        expect(client.createResource).not.toHaveBeenCalled();

        const manifest = await loadManifest(bundlePath);
        expect(manifest['doc-a'].calmHubId).toBe(locationUrl);
    });

    it('treats extra whitespace in local file as equal to minified remote', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA, null, 4));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient({
            getResource: vi.fn().mockResolvedValue(docA),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.updateResource).not.toHaveBeenCalled();
    });

    it('continues processing remaining entries after a create error', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const client = makeClient({
            getResource: vi.fn().mockRejectedValue(new HubClientError(404, 'Not Found', 'GET ...')),
            createResource: vi.fn()
                .mockRejectedValueOnce(new Error('create failed'))
                .mockResolvedValueOnce('/calm/namespaces/com.example/doc-b/versions/1.0.0'),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).resolves.not.toThrow();
        expect(client.createResource).toHaveBeenCalledTimes(2);
    });

    it('continues processing remaining entries after an update error', async () => {
        const localDocA = { ...docA, version: '2.0.0' };
        const localDocB = { ...docB, version: '2.0.0' };
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(localDocA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(localDocB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const client = makeClient({
            getResource: vi.fn().mockResolvedValue(docA),
            updateResource: vi.fn()
                .mockRejectedValueOnce(new Error('update failed'))
                .mockResolvedValueOnce('/calm/namespaces/com.example/doc-b/versions/1.1.0'),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).resolves.not.toThrow();
        expect(client.updateResource).toHaveBeenCalledTimes(2);
    });

    it('logs error and continues when CalmHub fetch fails with non-404', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const client = makeClient({
            getResource: vi.fn()
                .mockRejectedValueOnce(new HubClientError(500, 'Internal Server Error', 'GET ...'))
                .mockRejectedValueOnce(new HubClientError(404, 'Not Found', 'GET ...')),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).resolves.not.toThrow();
        expect(client.createResource).toHaveBeenCalledTimes(1);
        expect(client.createResource).toHaveBeenCalledWith(
            'com.example', 'doc-b', 'architecture', docB
        );
    });
});
