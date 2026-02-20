import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { loadJsonFile, pullReferencesFromBundle, pullWorkspaceBundle } from './pull';
import { saveManifest } from './bundle';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('pull', () => {
    const testDir = path.join(__dirname, 'test-pull');
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
        await mkdir(filesPath, { recursive: true });
    });

    describe('loadJsonFile', () => {
        it('should load and parse a valid JSON file', async () => {
            const testFile = path.join(testDir, 'valid.json');
            const expected = { key: 'value', number: 42 };
            await writeFile(testFile, JSON.stringify(expected));

            const result = await loadJsonFile(testFile);
            expect(result).toEqual(expected);
        });

        it('should throw error for non-existent file', async () => {
            const nonExistent = path.join(testDir, 'nonexistent.json');
            await expect(loadJsonFile(nonExistent)).rejects.toThrow();
        });

        it('should throw error for invalid JSON', async () => {
            const invalidFile = path.join(testDir, 'invalid.json');
            await writeFile(invalidFile, 'not valid json {{{');
            await expect(loadJsonFile(invalidFile)).rejects.toThrow();
        });

        it('should handle nested JSON structures', async () => {
            const testFile = path.join(testDir, 'nested.json');
            const expected = {
                level1: {
                    level2: {
                        level3: ['a', 'b', 'c']
                    }
                }
            };
            await writeFile(testFile, JSON.stringify(expected));

            const result = await loadJsonFile(testFile);
            expect(result).toEqual(expected);
        });
    });

    describe('pullReferencesFromBundle', () => {
        // Create a mock DocumentLoader for testing
        const createMockDocLoader = (responses: Record<string, object>) => ({
            resolvePath: vi.fn((_: string): string | undefined => undefined),
            loadMissingDocument: vi.fn(async (url: string): Promise<object> => {
                if (responses[url]) {
                    return responses[url];
                }
                throw new Error(`Not found: ${url}`);
            }),
            initialise: vi.fn(async () => {}),
            getLoadedDocuments: vi.fn(() => ({}))
        });

        it('should process files in manifest and extract references', async () => {
            // Create a document with a reference
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'https://example.com/schema.json'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            const mockLoader = createMockDocLoader({
                'https://example.com/schema.json': {
                    '$id': 'https://example.com/schema.json',
                    'type': 'object'
                }
            });

            await pullReferencesFromBundle(bundlePath, mockLoader);

            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/schema.json', 'schema');
        });

        it('should skip non-http references', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': './local-ref.json'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            const mockLoader = createMockDocLoader({});

            await pullReferencesFromBundle(bundlePath, mockLoader);

            expect(mockLoader.loadMissingDocument).not.toHaveBeenCalled();
        });

        it('should handle const-wrapped references', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                'properties': {
                    'requirement-url': {
                        'const': 'https://example.com/requirement.json'
                    }
                }
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            const mockLoader = createMockDocLoader({
                'https://example.com/requirement.json': {
                    '$id': 'https://example.com/requirement.json',
                    'type': 'requirement'
                }
            });

            await pullReferencesFromBundle(bundlePath, mockLoader);

            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/requirement.json', 'schema');
        });

        it('should not refetch already processed documents', async () => {
            // Document already in manifest
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'already-present'
            }));
            await writeFile(path.join(filesPath, 'present.json'), JSON.stringify({
                '$id': 'already-present'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json',
                'already-present': 'files/present.json'
            });

            const mockLoader = createMockDocLoader({});

            await pullReferencesFromBundle(bundlePath, mockLoader);

            // Should not try to load since it's already in manifest
            expect(mockLoader.loadMissingDocument).not.toHaveBeenCalled();
        });

        it('should handle files that fail to parse', async () => {
            await writeFile(path.join(filesPath, 'bad.json'), 'not valid json');
            await saveManifest(bundlePath, {
                'bad': 'files/bad.json'
            });

            const mockLoader = createMockDocLoader({});

            // Should not throw
            await expect(pullReferencesFromBundle(bundlePath, mockLoader)).resolves.not.toThrow();
        });

        it('should handle failed reference loads gracefully', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'https://example.com/missing.json'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            const mockLoader = createMockDocLoader({});  // No responses = all fail

            // Should not throw, just log warning
            await expect(pullReferencesFromBundle(bundlePath, mockLoader)).resolves.not.toThrow();
        });

        it('should recursively pull references from newly added documents', async () => {
            await writeFile(path.join(filesPath, 'root.json'), JSON.stringify({
                '$id': 'root',
                '$ref': 'https://example.com/level1.json'
            }));
            await saveManifest(bundlePath, {
                'root': 'files/root.json'
            });

            // level1 references level2
            const mockLoader = createMockDocLoader({
                'https://example.com/level1.json': {
                    '$id': 'https://example.com/level1.json',
                    '$ref': 'https://example.com/level2.json'
                },
                'https://example.com/level2.json': {
                    '$id': 'https://example.com/level2.json',
                    'type': 'leaf'
                }
            });

            await pullReferencesFromBundle(bundlePath, mockLoader);

            // Both level1 and level2 should be fetched
            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/level1.json', 'schema');
            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/level2.json', 'schema');
        });

        it('should process multiple reference types', async () => {
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                '$ref': 'https://example.com/ref.json',
                'requirement-url': 'https://example.com/req.json',
                'config-url': 'https://example.com/config.json'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            const mockLoader = createMockDocLoader({
                'https://example.com/ref.json': { '$id': 'https://example.com/ref.json' },
                'https://example.com/req.json': { '$id': 'https://example.com/req.json' },
                'https://example.com/config.json': { '$id': 'https://example.com/config.json' }
            });

            await pullReferencesFromBundle(bundlePath, mockLoader);

            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/ref.json', 'schema');
            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/req.json', 'schema');
            expect(mockLoader.loadMissingDocument).toHaveBeenCalledWith('https://example.com/config.json', 'schema');
        });
    });

    describe('pullWorkspaceBundle', () => {
        it('should use provided bundlePath', async () => {
            // Create a valid bundle with a document
            await writeFile(path.join(filesPath, 'doc.json'), JSON.stringify({
                '$id': 'doc',
                'data': 'test'
            }));
            await saveManifest(bundlePath, {
                'doc': 'files/doc.json'
            });

            // Should not throw when given a valid bundle path
            await expect(pullWorkspaceBundle(bundlePath)).resolves.not.toThrow();
        });

        it('should handle empty manifest', async () => {
            await saveManifest(bundlePath, {});

            // Should not throw with empty manifest
            await expect(pullWorkspaceBundle(bundlePath)).resolves.not.toThrow();
        });
    });
});
