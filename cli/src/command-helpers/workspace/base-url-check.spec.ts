import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { findBaseUrlMismatches, normalizeBaseUrl } from './base-url-check';
import type { WorkspaceManifest } from './bundle';

const idFor = (base: string, name: string) => `${base}/calm/namespaces/com.example/architectures/${name}/versions/1.0.0`;

describe('normalizeBaseUrl', () => {
    it('trims whitespace and trailing slashes', () => {
        expect(normalizeBaseUrl('  https://hub.example.com//  ')).toBe('https://hub.example.com');
    });
});

describe('findBaseUrlMismatches', () => {
    const bundlePath = path.resolve(__dirname, '../../../../sandbox/test-base-url-check');

    beforeEach(async () => {
        await rm(bundlePath, { recursive: true, force: true });
        await mkdir(path.join(bundlePath, 'files'), { recursive: true });
    });

    afterAll(async () => {
        await rm(bundlePath, { recursive: true, force: true });
    });

    async function write(name: string, content: string): Promise<void> {
        await writeFile(path.join(bundlePath, 'files', name), content);
    }

    it('reports only mapping documents whose $id base differs from the expected base', async () => {
        await write('ok.json', JSON.stringify({ $id: idFor('https://hub.example.com', 'ok'), title: 'Ok' }));
        await write('bad.json', JSON.stringify({ $id: idFor('http://localhost:8080', 'bad'), title: 'Bad' }));
        await write('slash.json', JSON.stringify({ $id: idFor('https://hub.example.com/', 'slash'), title: 'Slash' }));
        await write('unparseable.json', JSON.stringify({ $id: 'not-a-hub-id', title: 'X' }));
        await write('sad.md', '# not json');
        const manifest: WorkspaceManifest = {
            ok: { path: 'files/ok.json', type: 'architecture' },
            bad: { path: 'files/bad.json', type: 'architecture' },
            slash: { path: 'files/slash.json', type: 'architecture' },
            unparseable: { path: 'files/unparseable.json', type: 'architecture' },
            missing: { path: 'files/missing.json', type: 'architecture' },
            sad: { path: 'files/sad.md', type: 'sad', namespace: 'com.example', version: '1.0.0' },
        } as WorkspaceManifest;

        const result = await findBaseUrlMismatches(bundlePath, manifest, 'https://hub.example.com/');

        expect(result).toEqual([
            { id: 'bad', actual: 'http://localhost:8080' },
            { id: 'slash', actual: 'https://hub.example.com/' },
        ]);
    });
});
