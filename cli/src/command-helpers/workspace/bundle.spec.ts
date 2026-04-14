import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    loadManifest,
    saveManifest,
    determineDocumentId,
    addFileToBundle,
    addObjectToBundle,
    buildDependencyGraph,
    extractReferenceValue,
    MANIFEST_FILENAME,
    REFERENCE_PROPERTIES
} from './bundle';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('bundle', () => {
    const testDir = path.join(__dirname, 'test-bundle');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');

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
            expect(result.rel).toBe(path.relative(bundlePath, srcFile));

            const manifest = await loadManifest(bundlePath);
            expect(manifest['source-doc'].path).toBe(result.rel);
            expect(manifest['source-doc'].type).toBe('unknown');
        });

        it('should store provided type in manifest', async () => {
            await addFileToBundle(bundlePath, srcFile, { type: 'architecture' });

            const manifest = await loadManifest(bundlePath);
            expect(manifest['source-doc'].type).toBe('architecture');
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

    describe('addObjectToBundle', () => {
        it('should add object with $id property', async () => {
            const obj = { '$id': 'object-id', data: 'test' };
            const result = await addObjectToBundle(bundlePath, obj);

            expect(result.id).toBe('object-id');
            expect(existsSync(result.destPath)).toBe(true);

            const content = JSON.parse(await readFile(result.destPath, 'utf8'));
            expect(content).toEqual(obj);

            const manifest = await loadManifest(bundlePath);
            expect(manifest['object-id'].path).toBe(result.rel);
            expect(manifest['object-id'].type).toBe('unknown');
        });

        it('should store provided type in manifest', async () => {
            const obj = { '$id': 'typed-obj' };
            await addObjectToBundle(bundlePath, obj, undefined, 'schema');

            const manifest = await loadManifest(bundlePath);
            expect(manifest['typed-obj'].type).toBe('schema');
        });

        it('should use explicit id over $id property', async () => {
            const obj = { '$id': 'object-id', data: 'test' };
            const result = await addObjectToBundle(bundlePath, obj, 'explicit-id');

            expect(result.id).toBe('explicit-id');
        });

        it('should throw when no id can be determined', async () => {
            const obj = { data: 'no id' };
            await expect(addObjectToBundle(bundlePath, obj)).rejects.toThrow(
                'Cannot add object to bundle: no explicit id provided and object has no $id property.'
            );
        });

        it('should sanitize id for filename', async () => {
            const obj = { '$id': 'https://example.com/schema.json', data: 'test' };
            const result = await addObjectToBundle(bundlePath, obj);

            // Should not contain URL characters
            expect(result.destPath).not.toContain('://');
            expect(result.destPath).toMatch(/\.json$/);
        });

        it('should create files directory', async () => {
            expect(existsSync(filesPath)).toBe(false);
            await addObjectToBundle(bundlePath, { '$id': 'test' });
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
    });
});
