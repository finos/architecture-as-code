import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { pushWorkspaceToHub } from './push';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, HubClientError } from '@finos/calm-shared/src/hub/calm-hub-client';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const makeClient = (
    overrides: Partial<Pick<CalmHubClient, 'getMappedResourceVersions' | 'createMappedResourceVersion' | 'getMappedResourceByVersion'>> = {}
): CalmHubClient => ({
    getMappedResourceVersions: vi.fn(async () => []),
    createMappedResourceVersion: vi.fn(async () => '/calm/namespaces/com.example/architectures/my-arch/versions/1.0.0'),
    getMappedResourceByVersion: vi.fn(async () => ({})),
    ...overrides,
}) as unknown as CalmHubClient;

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

const BASE = 'https://hub.example.com';
const mappingId = (resource: string, version = '1.0.0', type = 'architectures', ns = 'com.example') =>
    `${BASE}/calm/namespaces/${ns}/${type}/${resource}/versions/${version}`;

describe('pushWorkspaceToHub', () => {
    const testDir = path.join(__dirname, 'test-push');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');

    // Well-formed mapping documents: $id encodes namespace/type/mappingId/version.
    const docA = { $id: mappingId('doc-a'), title: 'Doc A' };
    const docB = { $id: mappingId('doc-b'), title: 'Doc B' };

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

    it('resolves file path when entry.path is absolute', async () => {
        const absoluteFilePath = path.join(filesPath, 'doc-a.json');
        await writeFile(absoluteFilePath, JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: absoluteFilePath, type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.getMappedResourceVersions).toHaveBeenCalledWith('com.example', 'doc-a', 'architectures');
    });

    it('warns and returns early when manifest is empty', async () => {
        await saveManifest(bundlePath, {});
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
        expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
    });

    it('skips entries whose file does not exist', async () => {
        await saveManifest(bundlePath, {
            'missing': { path: 'files/missing.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
    });

    it('skips entries whose file is invalid JSON', async () => {
        await writeFile(path.join(filesPath, 'bad.json'), 'not json {{{');
        await saveManifest(bundlePath, {
            'bad': { path: 'files/bad.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
    });

    it('skips documents without a well-formed mapping $id', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ $id: 'doc-a', title: 'Doc A' }));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
        expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
    });

    it('skips documents whose $id type has no ResourceType (e.g. flows)', async () => {
        await writeFile(
            path.join(filesPath, 'flow.json'),
            JSON.stringify({ $id: mappingId('my-flow', '1.0.0', 'flows'), title: 'My Flow' })
        );
        await saveManifest(bundlePath, {
            'flow': { path: 'files/flow.json', type: 'flow', namespace: 'com.example' }
        });
        const client = makeClient();
        await pushWorkspaceToHub(bundlePath, client);
        expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
        expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
    });

    it('creates a new version when the resource does not exist yet and saves the Location to the manifest', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const locationUrl = mappingId('doc-a');
        const client = makeClient({
            getMappedResourceVersions: vi.fn().mockResolvedValue([]),
            createMappedResourceVersion: vi.fn().mockResolvedValue(locationUrl),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createMappedResourceVersion).toHaveBeenCalledWith(
            expect.objectContaining({ namespace: 'com.example', mapping: 'doc-a', type: 'architectures', version: '1.0.0' }),
            JSON.stringify(docA)
        );

        const manifest = await loadManifest(bundlePath);
        expect(manifest['doc-a'].calmHubId).toBe(locationUrl);
    });

    it('skips creating a version that already exists', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const client = makeClient({
            getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0']),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
    });

    it('creates the version when other versions exist but not this one', async () => {
        const localDoc = { $id: mappingId('doc-a', '2.0.0'), title: 'Doc A' };
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(localDoc));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const locationUrl = mappingId('doc-a', '2.0.0');
        const client = makeClient({
            getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0', '1.1.0']),
            createMappedResourceVersion: vi.fn().mockResolvedValue(locationUrl),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createMappedResourceVersion).toHaveBeenCalledWith(
            expect.objectContaining({ version: '2.0.0' }),
            JSON.stringify(localDoc)
        );
        const manifest = await loadManifest(bundlePath);
        expect(manifest['doc-a'].calmHubId).toBe(locationUrl);
    });

    it('continues processing remaining entries after a create error', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const client = makeClient({
            getMappedResourceVersions: vi.fn().mockResolvedValue([]),
            createMappedResourceVersion: vi.fn()
                .mockRejectedValueOnce(new Error('create failed'))
                .mockResolvedValueOnce(mappingId('doc-b')),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).resolves.not.toThrow();
        expect(client.createMappedResourceVersion).toHaveBeenCalledTimes(2);
    });

    it('logs error and continues when fetching existing versions fails', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const client = makeClient({
            getMappedResourceVersions: vi.fn()
                .mockRejectedValueOnce(new HubClientError(500, 'Internal Server Error', 'GET ...'))
                .mockResolvedValueOnce([]),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).resolves.not.toThrow();
        expect(client.createMappedResourceVersion).toHaveBeenCalledTimes(1);
        expect(client.createMappedResourceVersion).toHaveBeenCalledWith(
            expect.objectContaining({ mapping: 'doc-b' }),
            JSON.stringify(docB)
        );
    });

    describe('failIfModified (strict merge-time push)', () => {
        it('throws when an existing version has changed on disk', async () => {
            // disk content differs from what CalmHub has published at 1.0.0
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ ...docA, extra: 'edited' }));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0']),
                getMappedResourceByVersion: vi.fn().mockResolvedValue(docA),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).rejects.toThrow(/doc-a@1\.0\.0/);
            expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
        });

        it('skips an existing version whose content is unchanged (no throw)', async () => {
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0']),
                // CalmHub may return keys in a different order; content is still equal
                getMappedResourceByVersion: vi.fn().mockResolvedValue({ title: 'Doc A', $id: mappingId('doc-a') }),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).resolves.not.toThrow();
            expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
        });

        it('skips and does not fail when fetching the published version to compare fails', async () => {
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ ...docA, extra: 'edited' }));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0']),
                getMappedResourceByVersion: vi.fn().mockRejectedValue(new Error('boom')),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).resolves.not.toThrow();
            expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
        });

        it('skips when the compare fetch rejects with a non-Error value', async () => {
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ ...docA, extra: 'edited' }));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn().mockResolvedValue(['1.0.0']),
                getMappedResourceByVersion: vi.fn().mockRejectedValue('boom-string'),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).resolves.not.toThrow();
            expect(client.createMappedResourceVersion).not.toHaveBeenCalled();
        });

        it('still creates new versions and reports all conflicts before failing', async () => {
            // doc-a exists and changed (conflict); doc-b is new
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ ...docA, extra: 'edited' }));
            await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
                'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn(async (_ns: string, mappingId: string) =>
                    mappingId === 'doc-a' ? ['1.0.0'] : []),
                getMappedResourceByVersion: vi.fn().mockResolvedValue(docA),
                createMappedResourceVersion: vi.fn().mockResolvedValue(mappingId('doc-b')),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).rejects.toThrow(/doc-a@1\.0\.0/);
            expect(client.createMappedResourceVersion).toHaveBeenCalledTimes(1);
            expect(client.createMappedResourceVersion).toHaveBeenCalledWith(
                expect.objectContaining({ mapping: 'doc-b' }),
                JSON.stringify(docB)
            );
        });

        it('succeeds when all versions are new', async () => {
            await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
            await saveManifest(bundlePath, {
                'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
            });
            const client = makeClient({
                getMappedResourceVersions: vi.fn().mockResolvedValue([]),
                createMappedResourceVersion: vi.fn().mockResolvedValue(mappingId('doc-a')),
            });

            await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).resolves.not.toThrow();
            expect(client.createMappedResourceVersion).toHaveBeenCalledTimes(1);
        });
    });
});
