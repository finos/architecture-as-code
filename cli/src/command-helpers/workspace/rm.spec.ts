import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { removeDocumentFromManifest } from './rm';
import { loadManifest, saveManifest } from './bundle';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

describe('removeDocumentFromManifest', () => {
    const testDir = path.join(__dirname, 'test-rm');
    const bundlePath = path.join(testDir, 'bundle');

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
        await mkdir(bundlePath, { recursive: true });
    });

    it('returns false and leaves manifest unchanged when id is not found', async () => {
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture' },
        });

        const result = await removeDocumentFromManifest(bundlePath, 'missing-id');

        expect(result).toBe(false);
        const manifest = await loadManifest(bundlePath);
        expect(Object.keys(manifest)).toEqual(['doc-a']);
    });

    it('returns true and removes the entry when id is found', async () => {
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture' },
            'doc-b': { path: 'files/doc-b.json', type: 'pattern' },
        });

        const result = await removeDocumentFromManifest(bundlePath, 'doc-a');

        expect(result).toBe(true);
        const manifest = await loadManifest(bundlePath);
        expect(Object.keys(manifest)).toEqual(['doc-b']);
        expect(manifest['doc-a']).toBeUndefined();
    });

    it('returns true for last entry, leaving manifest empty', async () => {
        await saveManifest(bundlePath, {
            'only-doc': { path: 'files/only-doc.json', type: 'architecture' },
        });

        const result = await removeDocumentFromManifest(bundlePath, 'only-doc');

        expect(result).toBe(true);
        const manifest = await loadManifest(bundlePath);
        expect(Object.keys(manifest)).toHaveLength(0);
    });
});
