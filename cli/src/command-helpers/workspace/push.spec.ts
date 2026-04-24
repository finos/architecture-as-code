import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { pushWorkspaceToHub } from './push';
import { saveManifest } from './bundle';
import { CalmHubService } from '../../service/calm-hub-service';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const makeService = (overrides: Partial<{ [K in keyof CalmHubService]: CalmHubService[K] }> = {}): CalmHubService => ({
    getCalmHubResourceLatestVersion: vi.fn(),
    createNewCalmResource: vi.fn(async () => true),
    updateCalmResource: vi.fn(async () => '1.1.0'),
    ...overrides,
} as unknown as CalmHubService);

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
        const service = makeService();
        await pushWorkspaceToHub(bundlePath, service as never);
        expect(service.getCalmHubResourceLatestVersion).not.toHaveBeenCalled();
        expect(service.createNewCalmResource).not.toHaveBeenCalled();
    });

    it('skips entries that have no namespace', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture' }
        });
        const service = makeService();
        await pushWorkspaceToHub(bundlePath, service as never);
        expect(service.getCalmHubResourceLatestVersion).not.toHaveBeenCalled();
    });

    it('skips entries whose file does not exist', async () => {
        await saveManifest(bundlePath, {
            'missing': { path: 'files/missing.json', type: 'architecture', namespace: 'com.example' }
        });
        const service = makeService();
        await pushWorkspaceToHub(bundlePath, service as never);
        expect(service.getCalmHubResourceLatestVersion).not.toHaveBeenCalled();
    });

    it('skips entries whose file is invalid JSON', async () => {
        await writeFile(path.join(filesPath, 'bad.json'), 'not json {{{');
        await saveManifest(bundlePath, {
            'bad': { path: 'files/bad.json', type: 'architecture', namespace: 'com.example' }
        });
        const service = makeService();
        await pushWorkspaceToHub(bundlePath, service as never);
        expect(service.getCalmHubResourceLatestVersion).not.toHaveBeenCalled();
    });

    it('creates a resource when CalmHub returns 404', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const notFound = Object.assign(new Error('Not Found'), { response: { status: 404 } });
        const service = makeService({
            getCalmHubResourceLatestVersion: vi.fn().mockRejectedValue(notFound),
        });

        await pushWorkspaceToHub(bundlePath, service as never);

        expect(service.createNewCalmResource).toHaveBeenCalledWith(
            'com.example', 'doc-a', 'architecture', docA
        );
        expect(service.updateCalmResource).not.toHaveBeenCalled();
    });

    it('skips update when local and remote content are identical', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const service = makeService({
            // Remote returns same content (with extra whitespace — should still match)
            getCalmHubResourceLatestVersion: vi.fn().mockResolvedValue({ data: docA }),
        });

        await pushWorkspaceToHub(bundlePath, service as never);

        expect(service.updateCalmResource).not.toHaveBeenCalled();
        expect(service.createNewCalmResource).not.toHaveBeenCalled();
    });

    it('updates when local and remote content differ', async () => {
        const localDoc = { ...docA, version: '2.0.0' };
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(localDoc));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const service = makeService({
            getCalmHubResourceLatestVersion: vi.fn().mockResolvedValue({ data: docA }),
        });

        await pushWorkspaceToHub(bundlePath, service as never);

        expect(service.updateCalmResource).toHaveBeenCalledWith('com.example', 'doc-a', localDoc);
        expect(service.createNewCalmResource).not.toHaveBeenCalled();
    });

    it('treats extra whitespace in local file as equal to minified remote', async () => {
        // Write doc with extra indentation / newlines
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA, null, 4));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' }
        });
        const service = makeService({
            // Remote returns the same content but minified
            getCalmHubResourceLatestVersion: vi.fn().mockResolvedValue({ data: docA }),
        });

        await pushWorkspaceToHub(bundlePath, service as never);

        expect(service.updateCalmResource).not.toHaveBeenCalled();
    });

    it('continues processing remaining entries after a create error', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        const notFound = Object.assign(new Error('Not Found'), { response: { status: 404 } });
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const service = makeService({
            getCalmHubResourceLatestVersion: vi.fn().mockRejectedValue(notFound),
            createNewCalmResource: vi.fn()
                .mockRejectedValueOnce(new Error('create failed'))
                .mockResolvedValueOnce(true),
        });

        await expect(pushWorkspaceToHub(bundlePath, service as never)).resolves.not.toThrow();
        expect(service.createNewCalmResource).toHaveBeenCalledTimes(2);
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
        const service = makeService({
            getCalmHubResourceLatestVersion: vi.fn()
                .mockResolvedValue({ data: docA }),  // older version for both
            updateCalmResource: vi.fn()
                .mockRejectedValueOnce(new Error('update failed'))
                .mockResolvedValueOnce('1.1.0'),
        });

        await expect(pushWorkspaceToHub(bundlePath, service as never)).resolves.not.toThrow();
        expect(service.updateCalmResource).toHaveBeenCalledTimes(2);
    });

    it('logs error and continues when CalmHub fetch fails with non-404', async () => {
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify(docA));
        await writeFile(path.join(filesPath, 'doc-b.json'), JSON.stringify(docB));
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture', namespace: 'com.example' },
            'doc-b': { path: 'files/doc-b.json', type: 'architecture', namespace: 'com.example' },
        });
        const serverError = Object.assign(new Error('Internal Server Error'), { response: { status: 500 } });
        const notFound = Object.assign(new Error('Not Found'), { response: { status: 404 } });
        const service = makeService({
            getCalmHubResourceLatestVersion: vi.fn()
                .mockRejectedValueOnce(serverError)
                .mockRejectedValueOnce(notFound),
        });

        await expect(pushWorkspaceToHub(bundlePath, service as never)).resolves.not.toThrow();
        // doc-a errored with 500 (skipped), doc-b got 404 so was created
        expect(service.createNewCalmResource).toHaveBeenCalledTimes(1);
        expect(service.createNewCalmResource).toHaveBeenCalledWith(
            'com.example', 'doc-b', 'architecture', docB
        );
    });
});
