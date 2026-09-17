import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { pushWorkspaceToHub } from './push';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, HubClientError } from '@finos/calm-shared';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { createHash } from 'node:crypto';

const makeClient = (
    overrides: Partial<Pick<CalmHubClient,
        'getMappedResourceVersions' | 'createMappedResourceVersion' | 'getMappedResourceByVersion' |
        'createNarrativeDocument' | 'createNarrativeDocumentVersion' | 'getNarrativeDocumentIds' |
        'getNarrativeDocumentVersions' | 'getNarrativeDocumentVersion'>> = {}
): CalmHubClient => ({
    getMappedResourceVersions: vi.fn(async () => []),
    createMappedResourceVersion: vi.fn(async () => '/calm/namespaces/com.example/architectures/my-arch/versions/1.0.0'),
    getMappedResourceByVersion: vi.fn(async () => ({})),
    createNarrativeDocument: vi.fn(async () => '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0'),
    createNarrativeDocumentVersion: vi.fn(async () => '/api/calm/namespaces/com.example/documents/sad/42/versions/1.1.0'),
    getNarrativeDocumentIds: vi.fn(async () => []),
    getNarrativeDocumentVersions: vi.fn(async () => []),
    getNarrativeDocumentVersion: vi.fn(async () => ({ documentMarkdown: '' })),
    ...overrides,
}) as unknown as CalmHubClient;

vi.mock('@finos/calm-shared', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@finos/calm-shared')>()),
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
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

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

    async function writeFreshNarrative(markdown: string): Promise<void> {
        await writeFile(path.join(filesPath, 'payments.md'), markdown);
        await saveManifest(bundlePath, {
            payments: { path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
        });
    }

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

    it('creates a narrative document and stores its server identity', async () => {
        const markdown = '---\ntitle: Payments SAD\ndescription: Decisions\n---\n# Payments\n';
        await writeFile(path.join(filesPath, 'payments.md'), markdown);
        await saveManifest(bundlePath, {
            'payments-sad': { path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
        });
        const client = makeClient();

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createNarrativeDocument).toHaveBeenCalledWith('com.example', 'sad', {
            name: 'Payments SAD', description: 'Decisions', documentMarkdown: markdown,
        });
        expect(await loadManifest(bundlePath)).toMatchObject({
            'payments-sad': { calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0' },
        });
        expect((await loadManifest(bundlePath))['payments-sad']).not.toHaveProperty('createRecovery');
        expect(client.getNarrativeDocumentIds).toHaveBeenCalledOnce();
        expect(client.getNarrativeDocumentVersion).not.toHaveBeenCalled();
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('preserves an absolute valid Location without recovery', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const location = 'https://hub.example.com/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0';
        const client = makeClient({ createNarrativeDocument: vi.fn().mockResolvedValue(location) });

        await pushWorkspaceToHub(bundlePath, client);

        expect((await loadManifest(bundlePath)).payments).toMatchObject({ calmHubDocumentId: 42, calmHubId: location });
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('createRecovery');
        expect(client.getNarrativeDocumentIds).toHaveBeenCalledOnce();
        expect(client.getNarrativeDocumentVersion).not.toHaveBeenCalled();
    });

    it('preserves independent identities for multiple narratives', async () => {
        const payments = '---\ntitle: Payments SAD\n---\n# Payments';
        const orders = '---\ntitle: Orders Knowledge\n---\n# Orders';
        await writeFile(path.join(filesPath, 'payments.md'), payments);
        await writeFile(path.join(filesPath, 'orders.md'), orders);
        await saveManifest(bundlePath, {
            payments: { path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
            orders: { path: 'files/orders.md', type: 'knowledge', namespace: 'com.example', version: '1.0.0' },
        });
        const createNarrativeDocument = vi.fn().mockImplementation(async (_namespace, type) =>
            `/api/calm/namespaces/com.example/documents/${type}/${type === 'sad' ? 3 : 4}/versions/1.0.0`
        );
        const client = makeClient({ createNarrativeDocument });

        await pushWorkspaceToHub(bundlePath, client);

        expect(await loadManifest(bundlePath)).toMatchObject({
            payments: { calmHubDocumentId: 3 },
            orders: { calmHubDocumentId: 4 },
        });
        expect(createNarrativeDocument).toHaveBeenCalledTimes(2);
        expect(client.getNarrativeDocumentVersion).not.toHaveBeenCalled();
    });

    it('recovers a created narrative document from authoritative Hub state', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const getNarrativeDocumentIds = vi.fn()
            .mockResolvedValueOnce([1, 2])
            .mockResolvedValueOnce([1, 2, 3]);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds,
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect((await loadManifest(bundlePath)).payments).toMatchObject({
            calmHubDocumentId: 3,
            calmHubId: '/api/calm/namespaces/com.example/documents/sad/3/versions/1.0.0',
        });
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('createRecovery');
        expect(client.getNarrativeDocumentVersion).toHaveBeenCalledWith('com.example', 'sad', 3, '1.0.0');
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('recovers only the matching document when concurrent documents appear', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2, 3, 4]),
            getNarrativeDocumentVersion: vi.fn().mockImplementation(async (_namespace, _type, documentId) => ({
                documentMarkdown: documentId === 4 ? markdown : '---\ntitle: Other\n---\n# Other',
            })),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect((await loadManifest(bundlePath)).payments).toMatchObject({ calmHubDocumentId: 4 });
        expect(client.getNarrativeDocumentVersion).toHaveBeenCalledTimes(2);
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('uses the same recovery path when a confirmed create has no Location', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue(undefined),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2, 3]),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });

        await pushWorkspaceToHub(bundlePath, client);

        expect((await loadManifest(bundlePath)).payments).toMatchObject({
            calmHubDocumentId: 3,
            calmHubId: '/api/calm/namespaces/com.example/documents/sad/3/versions/1.0.0',
        });
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('createRecovery');
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('persists a recovery fence when the post-create list is stale', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2]),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/no new document has matching Markdown/);

        expect((await loadManifest(bundlePath)).payments).toEqual({
            path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        });
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('fails ambiguous recovery when multiple new documents match', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2, 3, 4]),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/multiple new documents have matching Markdown/);

        expect((await loadManifest(bundlePath)).payments).toMatchObject({
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        });
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('calmHubDocumentId');
        expect(client.getNarrativeDocumentVersion).toHaveBeenCalledTimes(2);
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
    });

    it('recovers a pending create on retry without another POST', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const firstClient = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2]),
        });
        await expect(pushWorkspaceToHub(bundlePath, firstClient)).rejects.toThrow(/no new document/);

        const retryClient = makeClient({
            getNarrativeDocumentIds: vi.fn().mockResolvedValue([1, 2, 3]),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });
        await pushWorkspaceToHub(bundlePath, retryClient);

        expect(retryClient.createNarrativeDocument).not.toHaveBeenCalled();
        expect((await loadManifest(bundlePath)).payments).toEqual({
            path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
            calmHubDocumentId: 3,
            calmHubId: '/api/calm/namespaces/com.example/documents/sad/3/versions/1.0.0',
        });
    });

    it('does not recover against changed local Markdown', async () => {
        const markdownA = '---\ntitle: Payments SAD\n---\n# Payload A';
        const markdownB = '---\ntitle: Payments SAD\n---\n# Payload B';
        await writeFreshNarrative(markdownA);
        const firstClient = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2]),
        });
        await expect(pushWorkspaceToHub(bundlePath, firstClient)).rejects.toThrow(/no new document/);
        const pending = (await loadManifest(bundlePath)).payments;

        await writeFile(path.join(filesPath, 'payments.md'), markdownB);
        const retryClient = makeClient({
            getNarrativeDocumentIds: vi.fn().mockResolvedValue([1, 2, 3, 4]),
            getNarrativeDocumentVersion: vi.fn().mockImplementation(async (_namespace, _type, documentId) => ({
                documentMarkdown: documentId === 3 ? markdownA : markdownB,
            })),
        });

        await expect(pushWorkspaceToHub(bundlePath, retryClient)).rejects.toThrow(/Markdown changed while create recovery is pending/);

        expect(retryClient.createNarrativeDocument).not.toHaveBeenCalled();
        expect(retryClient.getNarrativeDocumentIds).not.toHaveBeenCalled();
        expect(retryClient.getNarrativeDocumentVersion).not.toHaveBeenCalled();
        expect((await loadManifest(bundlePath)).payments).toEqual(pending);
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('calmHubDocumentId');
    });

    it('keeps a pending recovery fence when retry still has no match', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const pending = {
            path: 'files/payments.md', type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        };
        await saveManifest(bundlePath, { payments: pending });
        const client = makeClient({
            getNarrativeDocumentIds: vi.fn().mockResolvedValue([1, 2, 3]),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: '# Different' }),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/no new document has matching Markdown/);

        expect(client.createNarrativeDocument).not.toHaveBeenCalled();
        expect((await loadManifest(bundlePath)).payments).toEqual(pending);
    });

    it('keeps a pending recovery fence when retry remains ambiguous', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const pending = {
            path: 'files/payments.md', type: 'sad' as const, namespace: 'com.example', version: '1.0.0',
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        };
        await saveManifest(bundlePath, { payments: pending });
        const client = makeClient({
            getNarrativeDocumentIds: vi.fn().mockResolvedValue([1, 2, 3, 4]),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/multiple new documents have matching Markdown/);

        expect(client.createNarrativeDocument).not.toHaveBeenCalled();
        expect((await loadManifest(bundlePath)).payments).toEqual(pending);
    });

    it('keeps a recovery fence after a candidate GET error and never POSTs on retry', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const firstClient = makeClient({
            createNarrativeDocument: vi.fn().mockResolvedValue('/unexpected'),
            getNarrativeDocumentIds: vi.fn()
                .mockResolvedValueOnce([1, 2])
                .mockResolvedValueOnce([1, 2, 3]),
            getNarrativeDocumentVersion: vi.fn().mockRejectedValue(new Error('temporarily unavailable')),
        });
        await expect(pushWorkspaceToHub(bundlePath, firstClient)).rejects.toThrow(/temporarily unavailable/);
        expect((await loadManifest(bundlePath)).payments).toMatchObject({
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        });

        const retryClient = makeClient({
            getNarrativeDocumentIds: vi.fn().mockResolvedValue([1, 2, 3]),
            getNarrativeDocumentVersion: vi.fn().mockRejectedValue(new Error('still unavailable')),
        });
        await expect(pushWorkspaceToHub(bundlePath, retryClient)).rejects.toThrow(/still unavailable/);

        expect(retryClient.createNarrativeDocument).not.toHaveBeenCalled();
        expect((await loadManifest(bundlePath)).payments).toMatchObject({
            createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: sha256(markdown) },
        });
    });

    it.each([
        null,
        {},
        { documentIdsBeforeCreate: '1,2', documentMarkdownSha256: 'a'.repeat(64) },
        { documentIdsBeforeCreate: [0], documentMarkdownSha256: 'a'.repeat(64) },
        { documentIdsBeforeCreate: [1.5], documentMarkdownSha256: 'a'.repeat(64) },
        { documentIdsBeforeCreate: [Number.MAX_SAFE_INTEGER + 1], documentMarkdownSha256: 'a'.repeat(64) },
        { documentIdsBeforeCreate: [1, 2] },
        { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: 'not-a-digest' },
        { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: 'A'.repeat(64) },
        { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256: 'a'.repeat(63) },
    ])('rejects malformed persisted create recovery before parsing or posting: %j', async (createRecovery) => {
        const markdown = '# no frontmatter';
        await writeFreshNarrative(markdown);
        await saveManifest(bundlePath, {
            payments: {
                path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0', createRecovery,
            } as never,
        });
        const client = makeClient();

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/createRecovery/);

        expect(client.createNarrativeDocument).not.toHaveBeenCalled();
        expect(client.getNarrativeDocumentIds).not.toHaveBeenCalled();
    });

    it('does not run success recovery after a genuine create failure', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments';
        await writeFreshNarrative(markdown);
        const getNarrativeDocumentIds = vi.fn().mockResolvedValue([1, 2]);
        const client = makeClient({
            createNarrativeDocument: vi.fn().mockRejectedValue(
                new HubClientError(500, 'unavailable', 'POST /api/calm/namespaces/com.example/documents/sad')
            ),
            getNarrativeDocumentIds,
        });

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/Hub error 500/);

        expect(getNarrativeDocumentIds).toHaveBeenCalledOnce();
        expect(client.getNarrativeDocumentVersion).not.toHaveBeenCalled();
        expect(client.createNarrativeDocument).toHaveBeenCalledOnce();
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('calmHubDocumentId');
        expect((await loadManifest(bundlePath)).payments).not.toHaveProperty('createRecovery');
    });

    it('fails the completed push when a narrative document is invalid', async () => {
        await writeFile(path.join(filesPath, 'bad.md'), '# no frontmatter');
        await saveManifest(bundlePath, {
            bad: { path: 'files/bad.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
        });
        await expect(pushWorkspaceToHub(bundlePath, makeClient())).rejects.toThrow(/narrative document/);
        expect((await loadManifest(bundlePath)).bad.calmHubDocumentId).toBeUndefined();
    });

    it('creates a later narrative version and updates its location', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments\n';
        await writeFile(path.join(filesPath, 'payments.md'), markdown);
        await saveManifest(bundlePath, {
            payments: {
                path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.1.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            },
        });
        const client = makeClient({ getNarrativeDocumentVersions: vi.fn().mockResolvedValue(['1.0.0']) });

        await pushWorkspaceToHub(bundlePath, client);

        expect(client.createNarrativeDocumentVersion).toHaveBeenCalledWith('com.example', 'sad', 42, '1.1.0', expect.objectContaining({ documentMarkdown: markdown }));
        expect((await loadManifest(bundlePath)).payments.calmHubId).toContain('/1.1.0');
    });

    it('strictly detects changed Markdown at an existing narrative version', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Changed\n';
        await writeFile(path.join(filesPath, 'payments.md'), markdown);
        await saveManifest(bundlePath, {
            payments: {
                path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            },
        });
        const client = makeClient({
            getNarrativeDocumentVersions: vi.fn().mockResolvedValue(['1.0.0']),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown.replace('Changed', 'Published') }),
        });

        await expect(pushWorkspaceToHub(bundlePath, client, { failIfModified: true })).rejects.toThrow(/payments@1.0.0/);
    });

    it('idempotently skips an existing narrative version and accepts an exact strict comparison', async () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Payments\n';
        await writeFile(path.join(filesPath, 'payments.md'), markdown);
        await saveManifest(bundlePath, {
            payments: {
                path: 'files/payments.md', type: 'sad', namespace: 'com.example', version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            },
        });
        const client = makeClient({
            getNarrativeDocumentVersions: vi.fn().mockResolvedValue(['1.0.0']),
            getNarrativeDocumentVersion: vi.fn().mockResolvedValue({ documentMarkdown: markdown }),
        });

        await pushWorkspaceToHub(bundlePath, client);
        await pushWorkspaceToHub(bundlePath, client, { failIfModified: true });

        expect(client.createNarrativeDocumentVersion).not.toHaveBeenCalled();
    });

    it('fails narrative publish for missing source files and incomplete Hub identity', async () => {
        await saveManifest(bundlePath, {
            missing: { path: 'files/missing.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
            partial: { path: 'files/partial.md', type: 'sad', namespace: 'com.example', version: '1.0.0', calmHubId: '/partial' },
        });
        await writeFile(path.join(filesPath, 'partial.md'), '---\ntitle: Partial\n---\n# Partial');
        await expect(pushWorkspaceToHub(bundlePath, makeClient())).rejects.toThrow(/incomplete Hub identity/);
    });

    it('rejects malformed persisted narrative identity before calling Hub', async () => {
        await writeFile(path.join(filesPath, 'payments.md'), '---\ntitle: Payments SAD\n---\n# Payments');
        await saveManifest(bundlePath, {
            payments: {
                path: 'files/payments.md', type: 'sad', namespace: 42 as unknown as string, version: '1.1.0', calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/com.example/documents/sad/42/versions/1.0.0',
            },
        });
        const client = makeClient();

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/valid namespace/);
        expect(client.getNarrativeDocumentVersions).not.toHaveBeenCalled();
    });

    it('rejects a missing narrative namespace without Hub calls or manifest mutation', async () => {
        await writeFile(path.join(filesPath, 'payments.md'), '---\ntitle: Payments SAD\n---\n# Payments');
        const entry = { path: 'files/payments.md', type: 'sad' as const, version: '1.0.0' };
        await saveManifest(bundlePath, { payments: entry });
        const client = makeClient();

        await expect(pushWorkspaceToHub(bundlePath, client)).rejects.toThrow(/valid namespace/);
        expect(client.createNarrativeDocument).not.toHaveBeenCalled();
        expect(await loadManifest(bundlePath)).toEqual({ payments: entry });
    });

    it('rejects narrative manifests with no version or a non-initial unassigned version', async () => {
        await writeFile(path.join(filesPath, 'missing.md'), '---\ntitle: Missing\n---\n# Missing');
        await writeFile(path.join(filesPath, 'ahead.md'), '---\ntitle: Ahead\n---\n# Ahead');
        await saveManifest(bundlePath, {
            missing: { path: 'files/missing.md', type: 'sad', namespace: 'com.example' },
            ahead: { path: 'files/ahead.md', type: 'sad', namespace: 'com.example', version: '1.1.0' },
        });

        await expect(pushWorkspaceToHub(bundlePath, makeClient())).rejects.toThrow(/narrative document/);
    });

    it('fails narrative publish when a tracked path cannot be read', async () => {
        await saveManifest(bundlePath, {
            unreadable: { path: 'files', type: 'sad', namespace: 'com.example', version: '1.0.0' },
        });
        await expect(pushWorkspaceToHub(bundlePath, makeClient())).rejects.toThrow(/file could not be read/);
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
