import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    loadManifest,
    saveManifest,
    determineDocumentId,
    addFileToBundle,
    buildDependencyGraph,
    printBundleTree,
    extractReferenceValue,
    isNarrativeWorkspaceManifestEntry,
    MANIFEST_FILENAME,
    REFERENCE_PROPERTIES,
    type WorkspaceManifestEntry,
} from './bundle';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('bundle', () => {
    const testDir = path.join(__dirname, 'test-bundle');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');
    const documentMarkdownSha256 = 'a'.repeat(64);

    beforeAll(async () => {
        await mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
        // Clean up bundle directory before each test
        if (existsSync(bundlePath)) {
            await rm(bundlePath, { recursive: true, force: true });
        }
        await mkdir(bundlePath, { recursive: true });
    });

    describe('REFERENCE_PROPERTIES', () => {
        it('should include expected reference property names', () => {
            expect(REFERENCE_PROPERTIES).toContain('$ref');
            expect(REFERENCE_PROPERTIES).toContain('requirement-url');
            expect(REFERENCE_PROPERTIES).toContain('config-url');
        });
    });

    describe('MANIFEST_FILENAME', () => {
        it('should be workspace-manifest.json', () => {
            expect(MANIFEST_FILENAME).toBe('workspace-manifest.json');
        });
    });

    describe('WorkspaceManifestEntry', () => {
        it('discriminates narrative entries by document type', () => {
            const mapping: WorkspaceManifestEntry = { path: 'files/architecture.json', type: 'architecture' };
            const unpublishedNarrative: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0',
            };
            const publishedNarrative: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0',
                calmHubDocumentId: 42, calmHubId: '/documents/sad/42/versions/1.0.0',
            };
            const pendingNarrative: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0',
                createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
            };

            expect(isNarrativeWorkspaceManifestEntry(mapping)).toBe(false);
            expect(isNarrativeWorkspaceManifestEntry(unpublishedNarrative)).toBe(true);
            expect(isNarrativeWorkspaceManifestEntry(publishedNarrative)).toBe(true);
            expect(isNarrativeWorkspaceManifestEntry(pendingNarrative)).toBe(true);
            expect([mapping, publishedNarrative].filter(isNarrativeWorkspaceManifestEntry)[0].version).toBe('1.0.0');
        });

        it('rejects incomplete narrative identity and narrative-owned mapping state at compile time', () => {
            // @ts-expect-error Published narrative entries require calmHubId.
            const narrativeWithoutHubId: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0', calmHubDocumentId: 42,
            };
            // @ts-expect-error Published narrative entries require calmHubDocumentId.
            const narrativeWithoutDocumentId: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0', calmHubId: '/documents/sad/42/versions/1.0.0',
            };
            // @ts-expect-error Narrative entries require a manifest version.
            const narrativeWithoutVersion: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad',
            };
            // @ts-expect-error Mapping entries do not own a manifest version.
            const invalidMapping: WorkspaceManifestEntry = {
                path: 'files/architecture.json', type: 'architecture', version: '1.0.0',
            };
            // @ts-expect-error Mapping entries do not own a narrative document ID.
            const invalidMappingId: WorkspaceManifestEntry = {
                path: 'files/architecture.json', type: 'architecture', calmHubDocumentId: 42,
            };
            // @ts-expect-error Pending narrative entries cannot also have a published identity.
            const pendingPublishedNarrative: WorkspaceManifestEntry = {
                path: 'files/design.md', type: 'sad', version: '1.0.0',
                createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
                calmHubDocumentId: 42, calmHubId: '/documents/sad/42/versions/1.0.0',
            };

            expect(narrativeWithoutHubId.type).toBe('sad');
            expect(narrativeWithoutDocumentId.type).toBe('sad');
            expect(narrativeWithoutVersion.type).toBe('sad');
            expect(invalidMapping.type).toBe('architecture');
            expect(invalidMappingId.type).toBe('architecture');
            expect(pendingPublishedNarrative.type).toBe('sad');
        });
    });

    describe('extractReferenceValue', () => {
        it('should return string value directly', () => {
            expect(extractReferenceValue('https://example.com/schema.json')).toBe('https://example.com/schema.json');
        });

        it('should extract value from const object', () => {
            expect(extractReferenceValue({ const: 'https://example.com/schema.json' })).toBe('https://example.com/schema.json');
        });

        it('should return null for non-string value', () => {
            expect(extractReferenceValue(123)).toBeNull();
            expect(extractReferenceValue(true)).toBeNull();
            expect(extractReferenceValue(null)).toBeNull();
            expect(extractReferenceValue(undefined)).toBeNull();
        });

        it('should return null for object without const property', () => {
            expect(extractReferenceValue({ value: 'https://example.com/schema.json' })).toBeNull();
            expect(extractReferenceValue({})).toBeNull();
        });

        it('should return null for const object with non-string const', () => {
            expect(extractReferenceValue({ const: 123 })).toBeNull();
            expect(extractReferenceValue({ const: { nested: 'object' } })).toBeNull();
            expect(extractReferenceValue({ const: null })).toBeNull();
        });

        it('should handle arrays (return null)', () => {
            expect(extractReferenceValue(['https://example.com/schema.json'])).toBeNull();
        });
    });

    describe('loadManifest', () => {
        it('should return empty object when manifest does not exist', async () => {
            const manifest = await loadManifest(bundlePath);
            expect(manifest).toEqual({});
        });

        it('should load existing manifest in new format', async () => {
            const expected = {
                'doc1': { path: 'files/doc1.json', type: 'architecture' },
                'doc2': { path: 'files/doc2.json', type: 'schema' }
            };
            await writeFile(path.join(bundlePath, MANIFEST_FILENAME), JSON.stringify(expected));

            const manifest = await loadManifest(bundlePath);
            expect(manifest).toEqual(expected);
        });

        it('should preserve malformed persisted narrative identity for runtime validation', async () => {
            const malformed = {
                narrative: { path: 'files/design.md', type: 'sad', calmHubId: '/partial' },
            };
            await writeFile(path.join(bundlePath, MANIFEST_FILENAME), JSON.stringify(malformed));

            expect(await loadManifest(bundlePath)).toEqual(malformed);
        });

        it('should migrate old string-value format to new entry format', async () => {
            const old = { 'doc1': 'files/doc1.json', 'doc2': 'files/doc2.json' };
            await writeFile(path.join(bundlePath, MANIFEST_FILENAME), JSON.stringify(old));

            const manifest = await loadManifest(bundlePath);
            expect(manifest).toEqual({
                'doc1': { path: 'files/doc1.json', type: 'unknown' },
                'doc2': { path: 'files/doc2.json', type: 'unknown' }
            });
        });

        it('should return empty object when manifest contains invalid JSON', async () => {
            await writeFile(path.join(bundlePath, MANIFEST_FILENAME), 'not valid json {{{');

            const manifest = await loadManifest(bundlePath);
            expect(manifest).toEqual({});
        });
    });

    describe('saveManifest', () => {
        it('should save manifest to disk', async () => {
            const manifest = { 'doc1': { path: 'files/doc1.json', type: 'architecture' as const } };
            await saveManifest(bundlePath, manifest);

            const content = await readFile(path.join(bundlePath, MANIFEST_FILENAME), 'utf8');
            expect(JSON.parse(content)).toEqual(manifest);
        });

        it('should overwrite existing manifest', async () => {
            const oldManifest = { 'old': { path: 'files/old.json', type: 'unknown' as const } };
            await writeFile(path.join(bundlePath, MANIFEST_FILENAME), JSON.stringify(oldManifest));

            const newManifest = { 'new': { path: 'files/new.json', type: 'schema' as const } };
            await saveManifest(bundlePath, newManifest);

            const content = await readFile(path.join(bundlePath, MANIFEST_FILENAME), 'utf8');
            expect(JSON.parse(content)).toEqual(newManifest);
        });
    });

    describe('determineDocumentId', () => {
        const testFile = path.join(testDir, 'test-doc.json');

        it('should use explicit id when provided', async () => {
            await writeFile(testFile, JSON.stringify({ '$id': 'file-id' }));
            const id = await determineDocumentId(testFile, 'explicit-id');
            expect(id).toBe('explicit-id');
        });

        it('should trim explicit id', async () => {
            await writeFile(testFile, JSON.stringify({}));
            const id = await determineDocumentId(testFile, '  trimmed-id  ');
            expect(id).toBe('trimmed-id');
        });

        it('should use $id from file when no explicit id', async () => {
            await writeFile(testFile, JSON.stringify({ '$id': 'json-schema-id' }));
            const id = await determineDocumentId(testFile);
            expect(id).toBe('json-schema-id');
        });

        it('should fallback to filename without extension when no $id', async () => {
            await writeFile(testFile, JSON.stringify({ name: 'test' }));
            const id = await determineDocumentId(testFile);
            expect(id).toBe('test-doc');
        });

        it('should fallback to filename when file is invalid JSON', async () => {
            await writeFile(testFile, 'not json');
            const id = await determineDocumentId(testFile);
            expect(id).toBe('test-doc');
        });

        it('should fallback to filename when file does not exist', async () => {
            const id = await determineDocumentId(path.join(testDir, 'nonexistent.json'));
            expect(id).toBe('nonexistent');
        });
    });

    describe('addFileToBundle', () => {
        const srcFile = path.join(testDir, 'source.json');

        beforeEach(async () => {
            await writeFile(srcFile, JSON.stringify({ '$id': 'source-doc', data: 'test' }));
        });

        it('should add file as reference (default mode)', async () => {
            const result = await addFileToBundle(bundlePath, srcFile);

            expect(result.id).toBe('source-doc');
            expect(result.destPath).toBe(srcFile);
            expect(result.rel).toBe(srcFile);

            const manifest = await loadManifest(bundlePath);
            expect(manifest['source-doc'].path).toBe(srcFile);
            expect(manifest['source-doc'].type).toBe('unknown');
        });

        it('should store provided type in manifest', async () => {
            await addFileToBundle(bundlePath, srcFile, { type: 'architecture' });

            const manifest = await loadManifest(bundlePath);
            expect(manifest['source-doc'].type).toBe('architecture');
        });

        it('persists a complete narrative Hub identity with its version', async () => {
            await addFileToBundle(bundlePath, srcFile, {
                type: 'sad', version: '1.2.0', calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/1.2.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toMatchObject({
                version: '1.2.0', calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/1.2.0',
            });
        });

        it('allows a version-only narrative entry for a new document', async () => {
            await addFileToBundle(bundlePath, srcFile, { type: 'sad', version: '1.0.0' });
            expect((await loadManifest(bundlePath))['source-doc']).toMatchObject({ version: '1.0.0' });
        });

        it('keeps an unpublished narrative unpublished when re-added', async () => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '1.0.0',
                },
            });

            await addFileToBundle(bundlePath, srcFile, {
                type: 'sad', namespace: 'finos', version: '1.0.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: srcFile, type: 'sad', namespace: 'finos', version: '1.0.0',
            });
        });

        it('rejects re-adding a narrative while create recovery is pending', async () => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '1.0.0',
                createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, {
                copy: true, type: 'sad', namespace: 'finos', version: '1.0.0',
            })).rejects.toThrow(/pending create recovery/);

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
            expect(existsSync(path.join(filesPath, 'source.json'))).toBe(false);
        });

        it('rejects replacing a pending narrative with a mapping', async () => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '1.0.0',
                createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, {
                copy: true, type: 'architecture',
            })).rejects.toThrow(/pending create recovery/);

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
            expect(existsSync(path.join(filesPath, 'source.json'))).toBe(false);
        });

        it('allows a full compatible verified identity to reconcile pending recovery', async () => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '1.0.0',
                    createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
                },
            });

            await addFileToBundle(bundlePath, srcFile, {
                type: 'sad', namespace: 'finos', version: '1.0.0', calmHubDocumentId: 3,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/3/versions/1.0.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: srcFile, type: 'sad', namespace: 'finos', version: '1.0.0',
                calmHubDocumentId: 3,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/3/versions/1.0.0',
            });
            expect((await loadManifest(bundlePath))['source-doc']).not.toHaveProperty('createRecovery');
        });

        it.each([
            { type: 'knowledge' as const, namespace: 'finos', version: '1.0.0' },
            { type: 'sad' as const, namespace: 'other', version: '1.0.0' },
            { type: 'sad' as const, namespace: 'finos', version: '1.1.0' },
        ])('rejects verified identity outside the pending recovery scope', async ({ type, namespace, version }) => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '1.0.0',
                createRecovery: { documentIdsBeforeCreate: [1, 2], documentMarkdownSha256 },
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, {
                copy: true, type, namespace, version, calmHubDocumentId: 3,
                calmHubId: `/api/calm/namespaces/${namespace}/documents/${type}/3/versions/${version}`,
            })).rejects.toThrow(/pending create recovery scope/);

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
            expect(existsSync(path.join(filesPath, 'source.json'))).toBe(false);
        });

        it('preserves a published narrative Hub identity when re-added normally', async () => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '2.3.0',
                    calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
                },
            });

            await addFileToBundle(bundlePath, srcFile, {
                type: 'sad', namespace: 'finos', version: '1.0.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: srcFile, type: 'sad', namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            });
        });

        it.each([
            [false, srcFile],
            [true, 'files/source.json'],
        ])('preserves a published narrative Hub identity when changing its stored path (copy: %s)', async (copy, expectedPath) => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '2.3.0',
                    calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
                },
            });

            await addFileToBundle(bundlePath, srcFile, {
                copy, type: 'sad', namespace: 'finos', version: '1.0.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: expectedPath, type: 'sad', namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            });
        });

        it('accepts verified recovery when the existing published identity is equivalent', async () => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '2.3.0',
                    calmHubDocumentId: 42,
                    calmHubId: 'https://calmhub.example.com/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
                },
            });

            await addFileToBundle(bundlePath, srcFile, {
                type: 'sad', namespace: 'finos', version: '2.3.0', calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: srcFile, type: 'sad', namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            });
        });

        it('rejects verified recovery that conflicts with an existing published identity', async () => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, {
                copy: true, type: 'sad', namespace: 'finos', version: '2.3.0', calmHubDocumentId: 43,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/43/versions/2.3.0',
            })).rejects.toThrow(/recovery identity conflicts/);

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
            expect(existsSync(path.join(filesPath, 'source.json'))).toBe(false);
        });

        it.each([
            { type: 'knowledge' as const, namespace: 'finos' },
            { type: 'sad' as const, namespace: 'other' },
        ])('rejects a normal re-add that changes published identity scope', async ({ type, namespace }) => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, {
                type, namespace, version: '1.0.0',
            })).rejects.toThrow(/type or namespace conflicts/);

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
        });

        it('rejects replacing a published narrative with a mapping before copying or changing the manifest', async () => {
            await saveManifest(bundlePath, {
                'source-doc': {
                    path: 'old.md', type: 'sad', namespace: 'finos', version: '2.3.0',
                    calmHubDocumentId: 42,
                    calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
                },
            });
            const manifestPath = path.join(bundlePath, MANIFEST_FILENAME);
            const originalManifest = await readFile(manifestPath, 'utf8');

            await expect(addFileToBundle(bundlePath, srcFile, {
                copy: true, type: 'architecture',
            })).rejects.toThrow(/cannot be replaced with a non-narrative document/);

            expect(await readFile(manifestPath, 'utf8')).toBe(originalManifest);
            expect(existsSync(path.join(filesPath, 'source.json'))).toBe(false);
        });

        it.each([
            ['omitted', undefined],
            ['unknown', { type: 'unknown' as const }],
        ])('rejects replacing a published narrative when the incoming type is %s', async (_label, options) => {
            const existing = {
                path: 'old.md', type: 'sad' as const, namespace: 'finos', version: '2.3.0',
                calmHubDocumentId: 42,
                calmHubId: '/api/calm/namespaces/finos/documents/sad/42/versions/2.3.0',
            };
            await saveManifest(bundlePath, { 'source-doc': existing });

            await expect(addFileToBundle(bundlePath, srcFile, options)).rejects.toThrow(
                /cannot be replaced with a non-narrative document/
            );

            expect((await loadManifest(bundlePath))['source-doc']).toEqual(existing);
        });

        it('preserves normal replacement behavior for an existing mapping entry', async () => {
            await saveManifest(bundlePath, {
                'source-doc': { path: 'old.json', type: 'architecture', namespace: 'finos' },
            });

            await addFileToBundle(bundlePath, srcFile, {
                type: 'pattern', namespace: 'other',
            });

            expect((await loadManifest(bundlePath))['source-doc']).toEqual({
                path: srcFile, type: 'pattern', namespace: 'other',
            });
        });

        it.each([
            { type: 'sad' as const, version: '1.2.0', calmHubDocumentId: 42 },
            { type: 'sad' as const, version: '1.2.0', calmHubId: '/path' },
            { type: 'sad' as const, calmHubDocumentId: 42, calmHubId: '/path' },
        ])('rejects an incomplete narrative Hub identity', async (options) => {
            await expect(addFileToBundle(bundlePath, srcFile, options as never)).rejects.toThrow(/Hub identity/);
        });

        it('should copy file when copy option is true', async () => {
            const result = await addFileToBundle(bundlePath, srcFile, { copy: true });

            expect(result.id).toBe('source-doc');
            expect(result.destPath).toBe(path.join(filesPath, 'source.json'));
            expect(result.rel).toBe('files/source.json');
            expect(existsSync(result.destPath)).toBe(true);

            const manifest = await loadManifest(bundlePath);
            expect(manifest['source-doc'].path).toBe('files/source.json');
            expect(manifest['source-doc'].type).toBe('unknown');
        });

        it('should use explicit id when provided', async () => {
            const result = await addFileToBundle(bundlePath, srcFile, { id: 'custom-id' });

            expect(result.id).toBe('custom-id');
            const manifest = await loadManifest(bundlePath);
            expect(manifest['custom-id']).toBeDefined();
            expect(manifest['custom-id'].path).toBeDefined();
        });

        it('should use custom destName when copying', async () => {
            const result = await addFileToBundle(bundlePath, srcFile, { copy: true, destName: 'custom-name.json' });

            expect(result.destPath).toBe(path.join(filesPath, 'custom-name.json'));
            expect(result.rel).toBe('files/custom-name.json');
        });

        it('should create files directory when copying', async () => {
            expect(existsSync(filesPath)).toBe(false);
            await addFileToBundle(bundlePath, srcFile, { copy: true });
            expect(existsSync(filesPath)).toBe(true);
        });
    });

    describe('buildDependencyGraph', () => {
        beforeEach(async () => {
            await mkdir(filesPath, { recursive: true });
        });

        it('should return empty graph for empty manifest', async () => {
            const graph = await buildDependencyGraph(bundlePath);
            expect(graph.nodes).toEqual([]);
            expect(graph.edges).toEqual({});
            expect(graph.idToPath).toEqual({});
        });

        it('should build graph with nodes from manifest', async () => {
            await writeFile(path.join(filesPath, 'doc1.json'), JSON.stringify({ '$id': 'doc1' }));
            await writeFile(path.join(filesPath, 'doc2.json'), JSON.stringify({ '$id': 'doc2' }));
            await saveManifest(bundlePath, {
                'doc1': { path: 'files/doc1.json', type: 'unknown' },
                'doc2': { path: 'files/doc2.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('doc1');
            expect(graph.nodes).toContain('doc2');
            expect(graph.idToPath['doc1']).toBe(path.join(bundlePath, 'files/doc1.json'));
            expect(graph.idToPath['doc2']).toBe(path.join(bundlePath, 'files/doc2.json'));
        });

        it('should detect $ref edges between documents', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
            expect(graph.edges['child']).toEqual([]);
        });

        it('should detect requirement-url edges', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                'requirement-url': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should detect config-url edges', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                'config-url': 'child'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should detect references in JSON Schema const objects', async () => {
            // This is the pattern format where URLs are wrapped in { const: "url" }
            await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({
                '$id': 'pattern',
                'properties': {
                    'requirement-url': {
                        'const': 'requirement-doc'
                    },
                    'config-url': {
                        'const': 'config-doc'
                    }
                }
            }));
            await writeFile(path.join(filesPath, 'requirement.json'), JSON.stringify({
                '$id': 'requirement-doc'
            }));
            await writeFile(path.join(filesPath, 'config.json'), JSON.stringify({
                '$id': 'config-doc'
            }));
            await saveManifest(bundlePath, {
                'pattern': { path: 'files/pattern.json', type: 'pattern' },
                'requirement-doc': { path: 'files/requirement.json', type: 'unknown' },
                'config-doc': { path: 'files/config.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['pattern']).toContain('requirement-doc');
            expect(graph.edges['pattern']).toContain('config-doc');
        });

        it('should handle mixed direct and const reference formats', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'direct-ref',
                'requirement-url': { 'const': 'const-ref' }
            }));
            await writeFile(path.join(filesPath, 'direct.json'), JSON.stringify({
                '$id': 'direct-ref'
            }));
            await writeFile(path.join(filesPath, 'const.json'), JSON.stringify({
                '$id': 'const-ref'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'direct-ref': { path: 'files/direct.json', type: 'unknown' },
                'const-ref': { path: 'files/const.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('direct-ref');
            expect(graph.edges['parent']).toContain('const-ref');
        });

        it('should handle refs with fragments', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': 'child#/definitions/foo'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child',
                definitions: { foo: {} }
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should skip unreadable files', async () => {
            await writeFile(path.join(filesPath, 'good.json'), JSON.stringify({ '$id': 'good' }));
            await writeFile(path.join(filesPath, 'bad.json'), 'not valid json');
            await saveManifest(bundlePath, {
                'good': { path: 'files/good.json', type: 'unknown' },
                'bad': { path: 'files/bad.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('good');
            expect(graph.nodes).toContain('bad');
            expect(graph.edges['good']).toEqual([]);
            // 'bad' should not have edges since it couldn't be parsed
            expect(graph.edges['bad']).toBeUndefined();
        });

        it('resolves a relative file path reference to a manifest entry', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                '$ref': './files/child.json'
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({ '$id': 'child' }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should ignore http/https references not in manifest', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'https://external.com/schema.json'
            }));
            await saveManifest(bundlePath, {
                'doc': { path: 'files/doc.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['doc']).toEqual([]);
        });

        it('printBundleTree calls buildDependencyGraph and prints without throwing', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({ '$id': 'doc' }));
            await saveManifest(bundlePath, { 'doc': { path: 'files/doc.json', type: 'unknown' } });
            await expect(printBundleTree(bundlePath)).resolves.not.toThrow();
        });

        it('should detect nested $ref properties', async () => {
            await writeFile(path.join(filesPath, 'parent.json'), JSON.stringify({
                '$id': 'parent',
                properties: {
                    nested: {
                        '$ref': 'child'
                    }
                }
            }));
            await writeFile(path.join(filesPath, 'child.json'), JSON.stringify({
                '$id': 'child'
            }));
            await saveManifest(bundlePath, {
                'parent': { path: 'files/parent.json', type: 'unknown' },
                'child': { path: 'files/child.json', type: 'unknown' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.edges['parent']).toContain('child');
        });

        it('should resolve absolute paths stored by the default add-by-reference workflow', async () => {
            const absPath = path.join(filesPath, 'abs-doc.json');
            await writeFile(absPath, JSON.stringify({ '$id': 'abs-doc' }));
            // Default `add` (by reference) stores an absolute path in the manifest.
            await saveManifest(bundlePath, {
                'abs-doc': { path: absPath, type: 'architecture' }
            });

            const graph = await buildDependencyGraph(bundlePath);

            expect(graph.nodes).toContain('abs-doc');
            expect(graph.idToPath['abs-doc']).toBe(absPath);
            expect(graph.edges['abs-doc']).toEqual([]);
        });
    });
});
