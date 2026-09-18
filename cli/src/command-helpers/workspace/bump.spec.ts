import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { detectChangedResources, bumpWorkspace, canonicalEqual, maxIncrement } from './bump';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, ResourceChangeType } from '@finos/calm-shared';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';

vi.mock('@finos/calm-shared', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@finos/calm-shared')>()),
    initLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('./bundle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./bundle')>();
    return {
        ...actual,
        loadManifest: vi.fn(actual.loadManifest),
        saveManifest: vi.fn(actual.saveManifest),
    };
});

const BASE = 'https://hub.example.com';
const idAt = (resource: string, version: string, type = 'architectures', ns = 'com.example') =>
    `${BASE}/calm/namespaces/${ns}/${type}/${resource}/versions/${version}`;

interface ClientOpts {
    versions?: Record<string, string[]>;
    remote?: Record<string, object>;
    narrativeVersions?: string[];
    narrativeMarkdown?: string;
}
const makeClient = (opts: ClientOpts = {}): CalmHubClient => ({
    getMappedResourceVersions: vi.fn(async (_ns: string, mappingId: string) => opts.versions?.[mappingId] ?? []),
    getMappedResourceByVersion: vi.fn(async (_ns: string, mappingId: string, version: string) => opts.remote?.[`${mappingId}@${version}`] ?? {}),
    getNarrativeDocumentVersions: vi.fn(async () => opts.narrativeVersions ?? []),
    getNarrativeDocumentVersion: vi.fn(async () => ({ documentMarkdown: opts.narrativeMarkdown ?? '' })),
}) as unknown as CalmHubClient;

const deferred = <T = void>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

describe('bump', () => {
    const bundlePath = path.join(__dirname, 'test-bump', 'bundle');
    const filesPath = path.join(bundlePath, 'files');

    beforeAll(async () => { await mkdir(filesPath, { recursive: true }); });
    afterAll(async () => { await rm(path.join(__dirname, 'test-bump'), { recursive: true, force: true }); });
    beforeEach(async () => {
        await rm(bundlePath, { recursive: true, force: true });
        await mkdir(filesPath, { recursive: true });
    });

    const write = (name: string, obj: object) =>
        writeFile(path.join(filesPath, name), JSON.stringify(obj, null, 2), 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const read = async (name: string): Promise<any> => JSON.parse(await readFile(path.join(filesPath, name), 'utf8'));

    describe('canonicalEqual', () => {
        it('treats key-reordered objects as equal', () => {
            expect(canonicalEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        });
        it('detects value differences', () => {
            expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
        });
    });

    describe('detectChangedResources', () => {
        it('treats new, already-bumped, and unchanged narrative documents as clean', async () => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Published\n';
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            const baseEntry = {
                path: 'files/payments.md', type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            };

            await saveManifest(bundlePath, { payments: { ...baseEntry, calmHubDocumentId: undefined, calmHubId: undefined } });
            expect(await detectChangedResources(bundlePath, makeClient())).toEqual([]);

            await saveManifest(bundlePath, { payments: { ...baseEntry, version: '1.1.0' } });
            expect(await detectChangedResources(bundlePath, makeClient({ narrativeVersions: ['1.0.0'] }))).toEqual([]);

            await saveManifest(bundlePath, { payments: baseEntry });
            expect(await detectChangedResources(bundlePath, makeClient({ narrativeVersions: ['1.0.0'], narrativeMarkdown: markdown }))).toEqual([]);
        });

        it('treats pending create recovery as unassigned without mutating the fence', async () => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Published\n';
            const entry = {
                path: 'files/payments.md', type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
                createRecovery: {
                    documentIdsBeforeCreate: [1, 2],
                    documentMarkdownSha256: 'a'.repeat(64),
                },
            };
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            await saveManifest(bundlePath, { payments: entry });
            const client = makeClient();

            expect(await detectChangedResources(bundlePath, client)).toEqual([]);

            expect(client.getNarrativeDocumentVersions).not.toHaveBeenCalled();
            expect(await loadManifest(bundlePath)).toEqual({ payments: entry });
        });

        it('fails narrative checks with incomplete identity or missing source', async () => {
            await saveManifest(bundlePath, {
                partial: { path: 'files/missing.md', type: 'sad', namespace: 'com.example', version: '1.0.0', calmHubId: '/partial' },
            });
            await expect(detectChangedResources(bundlePath, makeClient())).rejects.toThrow(/file not found/);

            await writeFile(path.join(filesPath, 'partial.md'), '---\ntitle: Partial\n---\n# Partial');
            await saveManifest(bundlePath, {
                partial: { path: 'files/partial.md', type: 'sad', namespace: 'com.example', version: '1.0.0', calmHubId: '/partial' },
            });
            await expect(detectChangedResources(bundlePath, makeClient())).rejects.toThrow(/incomplete Hub identity/);
        });

        it('rejects a missing namespace before Hub calls and accepts a valid namespace', async () => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            const entry = {
                path: 'files/payments.md', type: 'sad' as const, version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            };
            const invalidClient = makeClient();
            await saveManifest(bundlePath, { payments: entry });
            await expect(detectChangedResources(bundlePath, invalidClient)).rejects.toThrow(/valid namespace/);
            expect(invalidClient.getNarrativeDocumentVersions).not.toHaveBeenCalled();

            const validClient = makeClient({ narrativeVersions: [] });
            await saveManifest(bundlePath, { payments: { ...entry, namespace: 'com.example' } });
            await expect(detectChangedResources(bundlePath, validClient)).resolves.toEqual([]);
            expect(validClient.getNarrativeDocumentVersions).toHaveBeenCalledWith('com.example', 'sad', 42);
        });

        it('preserves files and manifest when a later narrative entry fails the scan', async () => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Changed\n';
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            await saveManifest(bundlePath, {
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
                missing: { path: 'files/missing.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
            });
            const before = await readFile(path.join(bundlePath, 'workspace-manifest.json'), 'utf8');
            const client = makeClient({ narrativeVersions: ['1.0.0'], narrativeMarkdown: markdown.replace('Changed', 'Published') });

            await expect(bumpWorkspace(bundlePath, client, { increment: 'MINOR' })).rejects.toThrow(/file not found/);

            expect(client.getNarrativeDocumentVersion).toHaveBeenCalled();
            expect(await readFile(path.join(bundlePath, 'workspace-manifest.json'), 'utf8')).toBe(before);
            expect(await readFile(path.join(filesPath, 'payments.md'), 'utf8')).toBe(markdown);
        });

        it('fails narrative checks when Hub version retrieval fails', async () => {
            await writeFile(path.join(filesPath, 'payments.md'), '---\ntitle: Payments SAD\n---\n# Payments');
            await saveManifest(bundlePath, {
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const client = makeClient({ narrativeVersions: ['1.0.0'] });
            (client.getNarrativeDocumentVersion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Hub unavailable'));

            await expect(detectChangedResources(bundlePath, client)).rejects.toThrow(/Hub unavailable/);
        });

        it('checks narrative documents concurrently and returns changes in manifest order', async () => {
            await writeFile(path.join(filesPath, 'first.md'), '---\ntitle: First\n---\n# First changed');
            await writeFile(path.join(filesPath, 'second.md'), '---\ntitle: Second\n---\n# Second changed');
            await saveManifest(bundlePath, {
                first: {
                    path: 'files/first.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 41, calmHubId: '/api/calm/namespaces/com.example/documents/sad/41/versions/1.0.0',
                },
                second: {
                    path: 'files/second.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const firstEntered = deferred();
            const secondEntered = deferred();
            const releaseFirst = deferred();
            const releaseSecond = deferred();
            const secondCompleted = deferred();
            const client = makeClient();
            vi.mocked(client.getNarrativeDocumentVersions).mockImplementation(async (_namespace, _type, documentId) => {
                if (documentId === 41) {
                    firstEntered.resolve();
                    await releaseFirst.promise;
                } else {
                    secondEntered.resolve();
                    await releaseSecond.promise;
                }
                return ['1.0.0'];
            });
            vi.mocked(client.getNarrativeDocumentVersion).mockImplementation(async (_namespace, _type, documentId) => {
                if (documentId === 42) secondCompleted.resolve();
                return { documentMarkdown: '# Published' };
            });

            const detection = detectChangedResources(bundlePath, client);
            await Promise.all([firstEntered.promise, secondEntered.promise]);
            releaseSecond.resolve();
            await secondCompleted.promise;
            releaseFirst.resolve();

            await expect(detection).resolves.toMatchObject([{ id: 'first' }, { id: 'second' }]);
        });

        it('checks mapping documents concurrently', async () => {
            await write('first.json', { $id: idAt('first', '1.0.0'), title: 'First changed' });
            await write('second.json', { $id: idAt('second', '1.0.0'), title: 'Second changed' });
            await saveManifest(bundlePath, {
                first: { path: 'files/first.json', type: 'architecture' },
                second: { path: 'files/second.json', type: 'architecture' },
            });
            const firstEntered = deferred();
            const secondEntered = deferred();
            const releaseFirst = deferred();
            const releaseSecond = deferred();
            const secondCompleted = deferred();
            const client = makeClient();
            vi.mocked(client.getMappedResourceVersions).mockImplementation(async (_namespace, mappingId) => {
                if (mappingId === 'first') {
                    firstEntered.resolve();
                    await releaseFirst.promise;
                } else {
                    secondEntered.resolve();
                    await releaseSecond.promise;
                }
                return ['1.0.0'];
            });
            vi.mocked(client.getMappedResourceByVersion).mockImplementation(async (_namespace, mappingId) => {
                if (mappingId === 'second') secondCompleted.resolve();
                return { $id: idAt(mappingId, '1.0.0'), title: 'Published' };
            });

            const detection = detectChangedResources(bundlePath, client);
            await Promise.all([firstEntered.promise, secondEntered.promise]);
            releaseSecond.resolve();
            await secondCompleted.promise;
            releaseFirst.resolve();

            await expect(detection).resolves.toMatchObject([{ id: 'first' }, { id: 'second' }]);
        });

        it('overlaps mapping and narrative Hub checks', async () => {
            await write('architecture.json', { $id: idAt('architecture', '1.0.0'), title: 'Changed' });
            await writeFile(path.join(filesPath, 'sad.md'), '---\ntitle: SAD\n---\n# Changed');
            await saveManifest(bundlePath, {
                architecture: { path: 'files/architecture.json', type: 'architecture' },
                sad: {
                    path: 'files/sad.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const mappingEntered = deferred();
            const narrativeEntered = deferred();
            const releaseMapping = deferred();
            const releaseNarrative = deferred();
            const client = makeClient();
            vi.mocked(client.getMappedResourceVersions).mockImplementation(async () => {
                mappingEntered.resolve();
                await releaseMapping.promise;
                return ['1.0.0'];
            });
            vi.mocked(client.getMappedResourceByVersion).mockResolvedValue({
                $id: idAt('architecture', '1.0.0'), title: 'Published',
            });
            vi.mocked(client.getNarrativeDocumentVersions).mockImplementation(async () => {
                narrativeEntered.resolve();
                await releaseNarrative.promise;
                return ['1.0.0'];
            });
            vi.mocked(client.getNarrativeDocumentVersion).mockResolvedValue({ documentMarkdown: '# Published' });

            const detection = detectChangedResources(bundlePath, client);
            await Promise.all([mappingEntered.promise, narrativeEntered.promise]);
            releaseNarrative.resolve();
            releaseMapping.resolve();

            await expect(detection).resolves.toMatchObject([{ id: 'architecture' }, { id: 'sad' }]);
        });

        it('reports the first narrative Hub failure in manifest order', async () => {
            await writeFile(path.join(filesPath, 'first.md'), '---\ntitle: First\n---\n# First');
            await writeFile(path.join(filesPath, 'second.md'), '---\ntitle: Second\n---\n# Second');
            await saveManifest(bundlePath, {
                first: {
                    path: 'files/first.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 41, calmHubId: '/api/calm/namespaces/com.example/documents/sad/41/versions/1.0.0',
                },
                second: {
                    path: 'files/second.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const firstEntered = deferred();
            const secondEntered = deferred();
            const failFirst = deferred<string[]>();
            const failSecond = deferred<string[]>();
            const client = makeClient();
            vi.mocked(client.getNarrativeDocumentVersions).mockImplementation(async (_namespace, _type, documentId) => {
                if (documentId === 41) {
                    firstEntered.resolve();
                    return failFirst.promise;
                }
                secondEntered.resolve();
                return failSecond.promise;
            });

            const detection = detectChangedResources(bundlePath, client);
            await Promise.all([firstEntered.promise, secondEntered.promise]);
            failSecond.reject(new Error('second failure'));
            failFirst.reject(new Error('first failure'));

            await expect(detection).rejects.toThrow('first failure');
        });

        it('treats a document with no Hub versions as new and rejects missing manifest versions', async () => {
            await writeFile(path.join(filesPath, 'payments.md'), '---\ntitle: Payments SAD\n---\n# Payments');
            const entry = {
                path: 'files/payments.md', type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            };
            await saveManifest(bundlePath, { payments: entry });
            expect(await detectChangedResources(bundlePath, makeClient({ narrativeVersions: [] }))).toEqual([]);

            await saveManifest(bundlePath, { payments: { ...entry, version: undefined } });
            await expect(detectChangedResources(bundlePath, makeClient())).rejects.toThrow(/no manifest version/);
        });

        it('fails narrative checks when a tracked path cannot be read', async () => {
            await saveManifest(bundlePath, {
                unreadable: { path: 'files', type: 'sad', namespace: 'com.example', version: '1.0.0' },
            });
            await expect(detectChangedResources(bundlePath, makeClient())).rejects.toThrow(/could not be read/);
        });

        it('detects and bumps changed narrative Markdown without rewriting it', async () => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Changed\n';
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            await saveManifest(bundlePath, {
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example',
                    version: '1.0.0', calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const client = makeClient({ narrativeVersions: ['1.0.0'], narrativeMarkdown: markdown.replace('Changed', 'Published') });

            const changed = await detectChangedResources(bundlePath, client);
            expect(changed).toHaveLength(1);
            await bumpWorkspace(bundlePath, client, { increment: 'MINOR', preDetectedChanges: changed });

            expect((await loadManifest(bundlePath)).payments.version).toBe('1.1.0');
            expect(await readFile(path.join(filesPath, 'payments.md'), 'utf8')).toBe(markdown);
        });

        it.each([
            ['MAJOR', '2.0.0'],
            ['PATCH', '1.0.1'],
        ] as const)('applies a %s bump to a changed narrative document', async (increment, version) => {
            const markdown = '---\ntitle: Payments SAD\n---\n# Changed\n';
            await writeFile(path.join(filesPath, 'payments.md'), markdown);
            await saveManifest(bundlePath, {
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0', calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });
            const client = makeClient({ narrativeVersions: ['1.0.0'], narrativeMarkdown: markdown.replace('Changed', 'Published') });

            await bumpWorkspace(bundlePath, client, { increment });
            expect((await loadManifest(bundlePath)).payments.version).toBe(version);

            expect(await bumpWorkspace(bundlePath, client, { increment })).toMatchObject({ bumped: [] });
        });

        it('skips a brand-new resource with no versions in CalmHub', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const changed = await detectChangedResources(bundlePath, makeClient({ versions: {} }));
            expect(changed).toHaveLength(0);
        });

        it('skips a doc already ahead of CalmHub (already bumped, not pushed)', async () => {
            await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const changed = await detectChangedResources(bundlePath, makeClient({ versions: { a: ['1.0.0'] } }));
            expect(changed).toHaveLength(0);
        });

        it('skips a doc whose content matches CalmHub at its version', async () => {
            const doc = { $id: idAt('a', '1.0.0'), title: 'A' };
            await write('a.json', doc);
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const changed = await detectChangedResources(bundlePath, makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': doc },
            }));
            expect(changed).toHaveLength(0);
        });

        it('detects a doc changed on disk relative to CalmHub', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const changed = await detectChangedResources(bundlePath, makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            }));
            expect(changed).toHaveLength(1);
            expect(changed[0]).toMatchObject({ id: 'a', currentVersion: '1.0.0', latestHubVersion: '1.0.0' });
        });

        it('warns and skips a doc with an unmappable $id', async () => {
            await write('a.json', { $id: 'bare-id', title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient();
            const changed = await detectChangedResources(bundlePath, client);
            expect(changed).toHaveLength(0);
            expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
        });

        it('warns and skips when a tracked file is missing', async () => {
            await saveManifest(bundlePath, { 'a': { path: 'files/missing.json', type: 'architecture' } });
            const client = makeClient();
            const changed = await detectChangedResources(bundlePath, client);
            expect(changed).toHaveLength(0);
            expect(client.getMappedResourceVersions).not.toHaveBeenCalled();
        });

        it('logs and skips when fetching versions fails', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient();
            (client.getMappedResourceVersions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
            const changed = await detectChangedResources(bundlePath, client);
            expect(changed).toHaveLength(0);
        });

        it('logs and skips when fetching the remote version fails', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient({ versions: { a: ['1.0.0'] } });
            (client.getMappedResourceByVersion as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
            const changed = await detectChangedResources(bundlePath, client);
            expect(changed).toHaveLength(0);
        });
    });

    describe('bumpWorkspace', () => {
        it('loads and saves the manifest once for a batch of narrative updates', async () => {
            const entry = (name: string, documentId: number) => ({
                path: `files/${name}.md`, type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
                calmHubDocumentId: documentId,
                calmHubId: `/api/calm/namespaces/com.example/documents/sad/${documentId}/versions/1.0.0`,
            });
            await writeFile(path.join(filesPath, 'payments.md'), '# Payments');
            await writeFile(path.join(filesPath, 'orders.md'), '# Orders');
            await saveManifest(bundlePath, { payments: entry('payments', 42), orders: entry('orders', 43) });
            vi.mocked(loadManifest).mockClear();
            vi.mocked(saveManifest).mockClear();

            const result = await bumpWorkspace(bundlePath, makeClient(), {
                increment: 'MINOR',
                preDetectedChanges: [
                    { id: 'payments', kind: 'narrative', filePath: path.join(filesPath, 'payments.md'), currentVersion: '1.0.0', latestHubVersion: '1.0.0' },
                    { id: 'orders', kind: 'narrative', filePath: path.join(filesPath, 'orders.md'), currentVersion: '1.0.0', latestHubVersion: '1.0.0' },
                ],
            });

            expect(result.bumped.map(({ id, toVersion }) => ({ id, toVersion }))).toEqual([
                { id: 'payments', toVersion: '1.1.0' },
                { id: 'orders', toVersion: '1.1.0' },
            ]);
            expect(saveManifest).toHaveBeenCalledTimes(1);
            expect(saveManifest).toHaveBeenCalledWith(bundlePath, expect.objectContaining({
                payments: expect.objectContaining({ version: '1.1.0' }),
                orders: expect.objectContaining({ version: '1.1.0' }),
            }));
            const saveCallOrder = vi.mocked(saveManifest).mock.invocationCallOrder[0];
            const updatePhaseLoads = vi.mocked(loadManifest).mock.invocationCallOrder.filter(order => order < saveCallOrder);
            expect(updatePhaseLoads).toHaveLength(1);
        });

        it('does not save a partially validated narrative batch', async () => {
            await writeFile(path.join(filesPath, 'payments.md'), '# Payments');
            await saveManifest(bundlePath, {
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
                architecture: { path: 'files/a.json', type: 'architecture' },
            });
            vi.mocked(loadManifest).mockClear();
            vi.mocked(saveManifest).mockClear();

            await expect(bumpWorkspace(bundlePath, makeClient(), {
                increment: 'MINOR',
                preDetectedChanges: [
                    { id: 'payments', kind: 'narrative', filePath: path.join(filesPath, 'payments.md'), currentVersion: '1.0.0', latestHubVersion: '1.0.0' },
                    { id: 'architecture', kind: 'narrative', filePath: path.join(filesPath, 'a.json'), currentVersion: '1.0.0', latestHubVersion: '1.0.0' },
                ],
            })).rejects.toThrow(/no longer a narrative manifest entry/);

            expect(loadManifest).toHaveBeenCalledTimes(1);
            expect(saveManifest).not.toHaveBeenCalled();
            expect((await loadManifest(bundlePath)).payments.version).toBe('1.0.0');
        });

        it('does not save the manifest update phase for mapping-only changes', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { a: { path: 'files/a.json', type: 'architecture' } });
            vi.mocked(saveManifest).mockClear();

            const result = await bumpWorkspace(bundlePath, makeClient(), {
                increment: 'MINOR',
                preDetectedChanges: [{
                    id: 'a', kind: 'mapping', filePath: path.join(filesPath, 'a.json'),
                    currentVersion: '1.0.0', latestHubVersion: '1.0.0',
                    metadata: {
                        rawDocumentId: idAt('a', '1.0.0'), baseUrl: BASE, name: 'A',
                        namespace: 'com.example', type: 'architectures', mapping: 'a', version: '1.0.0',
                    },
                }],
            });

            expect(saveManifest).not.toHaveBeenCalled();
            expect(result.bumped).toEqual([
                expect.objectContaining({ id: 'a', fromVersion: '1.0.0', toVersion: '1.1.0' }),
            ]);
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
        });

        it('preserves result order and updates both document kinds in a mixed batch', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await writeFile(path.join(filesPath, 'payments.md'), '# Payments');
            await saveManifest(bundlePath, {
                a: { path: 'files/a.json', type: 'architecture' },
                payments: {
                    path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                    calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
                },
            });

            const result = await bumpWorkspace(bundlePath, makeClient(), {
                increment: 'MINOR',
                preDetectedChanges: [
                    {
                        id: 'a', kind: 'mapping', filePath: path.join(filesPath, 'a.json'),
                        currentVersion: '1.0.0', latestHubVersion: '1.0.0',
                        metadata: {
                            rawDocumentId: idAt('a', '1.0.0'), baseUrl: BASE, name: 'A',
                            namespace: 'com.example', type: 'architectures', mapping: 'a', version: '1.0.0',
                        },
                    },
                    { id: 'payments', kind: 'narrative', filePath: path.join(filesPath, 'payments.md'), currentVersion: '1.0.0', latestHubVersion: '1.0.0' },
                ],
            });

            expect(result.bumped.map(({ id, toVersion }) => ({ id, toVersion }))).toEqual([
                { id: 'a', toVersion: '1.1.0' },
                { id: 'payments', toVersion: '1.1.0' },
            ]);
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
            expect((await loadManifest(bundlePath)).payments.version).toBe('1.1.0');
        });

        it('bumps a changed doc by one MINOR increment relative to the latest hub version', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            });

            const result = await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect(result.bumped).toEqual([
                expect.objectContaining({ id: 'a', fromVersion: '1.0.0', toVersion: '1.1.0' }),
            ]);
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
        });

        it('does not inject an empty description into a document that never had one', async () => {
            // updateDocumentMetadata (used by hub push to normalise against CalmHub's stored
            // form) defaults a missing description to ''. Workspace documents are pushed raw and
            // validated locally, so that default would fail the "no empty string properties" rule.
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            });

            await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect(await read('a.json')).not.toHaveProperty('description');
        });

        it('preserves an existing description when bumping', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', description: 'existing', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A', description: 'existing' } },
            });

            await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect((await read('a.json')).description).toBe('existing');
        });

        it('honours --major / --patch via the increment option', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            });

            await bumpWorkspace(bundlePath, client, { increment: 'MAJOR' });
            expect((await read('a.json')).$id).toBe(idAt('a', '2.0.0'));
        });

        it('repoints references in other tracked docs to the bumped $id (fragment preserved)', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            const bDoc = { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') + '#/n' }] };
            await write('b.json', bDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' }, 'b@1.0.0': bDoc },
            });

            await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
            expect((await read('b.json')).nodes[0].$ref).toBe(idAt('a', '1.1.0') + '#/n');
        });

        it('cascade-bumps a dependent doc whose reference was rewritten', async () => {
            // A changes → A bumped → B's ref to A rewritten → B cascade-bumped
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            const bDoc = { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') }] };
            await write('b.json', bDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' }, 'b@1.0.0': bDoc },
            });

            const result = await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect(result.bumped).toHaveLength(2);
            expect(result.bumped).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: 'a', fromVersion: '1.0.0', toVersion: '1.1.0' }),
                expect.objectContaining({ id: 'b', fromVersion: '1.0.0', toVersion: '1.1.0' }),
            ]));
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
            expect((await read('b.json')).$id).toBe(idAt('b', '1.1.0'));
            expect((await read('b.json')).nodes[0].$ref).toBe(idAt('a', '1.1.0'));
        });

        it('cascades through a three-level chain in one call', async () => {
            // A → B → C: changing A should cascade-bump B and C
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            const bDoc = { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') }] };
            const cDoc = { $id: idAt('c', '1.0.0'), title: 'C', nodes: [{ $ref: idAt('b', '1.0.0') }] };
            await write('b.json', bDoc);
            await write('c.json', cDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
                'c': { path: 'files/c.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'], c: ['1.0.0'] },
                remote: {
                    'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' },
                    'b@1.0.0': bDoc,
                    'c@1.0.0': cDoc,
                },
            });

            const result = await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect(result.bumped).toHaveLength(3);
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
            expect((await read('b.json')).$id).toBe(idAt('b', '1.1.0'));
            expect((await read('c.json')).$id).toBe(idAt('c', '1.1.0'));
            expect((await read('b.json')).nodes[0].$ref).toBe(idAt('a', '1.1.0'));
            expect((await read('c.json')).nodes[0].$ref).toBe(idAt('b', '1.1.0'));
        });

        it('does not cascade-bump a dependent with a non-CalmHub $id', async () => {
            // If B has a non-conformant $id, its version can't be bumped — warn and move on
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await write('b.json', { $id: 'bare-id', title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            });

            const result = await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            // Only A is bumped; B's ref is still rewritten even though its version isn't bumped
            expect(result.bumped).toEqual([
                expect.objectContaining({ id: 'a', toVersion: '1.1.0' }),
            ]);
            expect((await read('b.json')).nodes[0].$ref).toBe(idAt('a', '1.1.0'));
            expect((await read('b.json')).$id).toBe('bare-id');
        });

        it('only bumps once across edit -> bump -> edit -> bump', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edit-1' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            // CalmHub stays at 1.0.0 throughout (nothing is pushed between bumps)
            const client = makeClient({
                versions: { a: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' } },
            });

            await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));

            // Edit again, then bump again — version must stay at 1.1.0
            const a = await read('a.json');
            a.extra = 'edit-2';
            await write('a.json', a);
            const second = await bumpWorkspace(bundlePath, client, { increment: 'MINOR' });

            expect(second.bumped).toHaveLength(0);
            expect((await read('a.json')).$id).toBe(idAt('a', '1.1.0'));
        });

        it('applies different per-document increments for each directly-changed doc', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await write('b.json', { $id: idAt('b', '2.0.0', 'patterns'), title: 'B', extra: 'edited' });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'pattern' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['2.0.0'] },
                remote: {
                    'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' },
                    'b@2.0.0': { $id: idAt('b', '2.0.0', 'patterns'), title: 'B' },
                },
            });

            const perDocIncrements = new Map([
                ['a', 'PATCH' as const],
                ['b', 'MAJOR' as const],
            ]);
            const changedResources = await detectChangedResources(bundlePath, client);
            const result = await bumpWorkspace(bundlePath, client, {
                increment: 'MINOR',
                perDocIncrements,
                preDetectedChanges: changedResources,
            });

            expect(result.bumped.find(b => b.id === 'a')).toMatchObject({ toVersion: '1.0.1', increment: 'PATCH' });
            expect(result.bumped.find(b => b.id === 'b')).toMatchObject({ toVersion: '3.0.0', increment: 'MAJOR' });
            expect((await read('a.json')).$id).toBe(idAt('a', '1.0.1'));
            expect((await read('b.json')).$id).toBe(idAt('b', '3.0.0', 'patterns'));
        });

        it('cascade-bumped doc receives the trigger increment via getCascadeIncrement callback', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            const bDoc = { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') }] };
            await write('b.json', bDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' }, 'b@1.0.0': bDoc },
            });

            const cascadeCalls: Array<{ docId: string; triggeredBy: string; defaultIncrement: string }> = [];
            const changedResources = await detectChangedResources(bundlePath, client);
            const result = await bumpWorkspace(bundlePath, client, {
                increment: 'MINOR',
                perDocIncrements: new Map([['a', 'MAJOR']]),
                preDetectedChanges: changedResources,
                getCascadeIncrement: async (docId, triggeredBy, defaultIncrement) => {
                    cascadeCalls.push({ docId, triggeredBy, defaultIncrement });
                    return defaultIncrement; // accept the default
                },
            });

            // B cascaded because A was bumped; its default should have been MAJOR (from A)
            expect(cascadeCalls).toHaveLength(1);
            expect(cascadeCalls[0]).toMatchObject({ docId: 'b', defaultIncrement: 'MAJOR' });
            expect(result.bumped.find(b => b.id === 'b')).toMatchObject({ toVersion: '2.0.0', increment: 'MAJOR' });
            expect((await read('b.json')).$id).toBe(idAt('b', '2.0.0'));
        });

        it('getCascadeIncrement can override the cascade default', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            const bDoc = { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') }] };
            await write('b.json', bDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'] },
                remote: { 'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' }, 'b@1.0.0': bDoc },
            });

            const changedResources = await detectChangedResources(bundlePath, client);
            const result = await bumpWorkspace(bundlePath, client, {
                increment: 'MINOR',
                perDocIncrements: new Map([['a', 'MAJOR']]),
                preDetectedChanges: changedResources,
                // User chose PATCH for the cascade despite the MAJOR default
                getCascadeIncrement: async () => 'PATCH',
            });

            expect(result.bumped.find(b => b.id === 'b')).toMatchObject({ toVersion: '1.0.1', increment: 'PATCH' });
        });

        it('maxIncrement with mixed triggers returns the highest', async () => {
            // Three-level chain: A=PATCH, B=MINOR → C's default should be MINOR (max of A's/B's applied)
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A', extra: 'edited' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', extra: 'edited' });
            const cDoc = {
                $id: idAt('c', '1.0.0'), title: 'C',
                nodes: [{ $ref: idAt('a', '1.0.0') }, { $ref: idAt('b', '1.0.0') }],
            };
            await write('c.json', cDoc);
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
                'c': { path: 'files/c.json', type: 'architecture' },
            });
            const client = makeClient({
                versions: { a: ['1.0.0'], b: ['1.0.0'], c: ['1.0.0'] },
                remote: {
                    'a@1.0.0': { $id: idAt('a', '1.0.0'), title: 'A' },
                    'b@1.0.0': { $id: idAt('b', '1.0.0'), title: 'B' },
                    'c@1.0.0': cDoc,
                },
            });

            const seenDefaults: ResourceChangeType[] = [];
            const changedResources = await detectChangedResources(bundlePath, client);
            await bumpWorkspace(bundlePath, client, {
                increment: 'MINOR',
                perDocIncrements: new Map<string, ResourceChangeType>([['a', 'PATCH'], ['b', 'MINOR']]),
                preDetectedChanges: changedResources,
                getCascadeIncrement: async (_docId, _triggeredBy, defaultIncrement) => {
                    seenDefaults.push(defaultIncrement);
                    return defaultIncrement;
                },
            });

            // C is triggered by both A (PATCH) and B (MINOR) in one pass; max is MINOR
            expect(seenDefaults).toContain('MINOR');
            expect(seenDefaults).not.toContain('MAJOR');
        });
    });

    describe('maxIncrement', () => {
        it('returns MAJOR when MAJOR is present', () => {
            expect(maxIncrement(['PATCH', 'MAJOR', 'MINOR'])).toBe('MAJOR');
        });
        it('returns MINOR when MINOR is present but not MAJOR', () => {
            expect(maxIncrement(['PATCH', 'MINOR'])).toBe('MINOR');
        });
        it('returns PATCH when only PATCH is present', () => {
            expect(maxIncrement(['PATCH'])).toBe('PATCH');
        });
        it('returns PATCH for an empty list', () => {
            expect(maxIncrement([])).toBe('PATCH');
        });
    });
});
