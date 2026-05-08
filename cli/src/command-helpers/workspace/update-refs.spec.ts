import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { stripVersionSuffix, buildRefRules, resolveNewRef, updateWorkspaceRefs } from './update-refs';
import { saveManifest } from './bundle';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// ─── stripVersionSuffix ──────────────────────────────────────────────────────

describe('stripVersionSuffix', () => {
    it('strips /versions/<version> from a CalmHub path', () => {
        expect(stripVersionSuffix('/calm/namespaces/com.example/doc/versions/1.0.0'))
            .toBe('/calm/namespaces/com.example/doc');
    });

    it('returns null when there is no version segment', () => {
        expect(stripVersionSuffix('/calm/namespaces/com.example/doc')).toBeNull();
        expect(stripVersionSuffix('workshop-pattern')).toBeNull();
    });

    it('ignores fragment identifiers when stripping', () => {
        expect(stripVersionSuffix('/calm/namespaces/ns/doc/versions/1.0.0#/Foo'))
            .toBe('/calm/namespaces/ns/doc');
    });
});

// ─── buildRefRules ───────────────────────────────────────────────────────────

describe('buildRefRules', () => {
    it('only includes entries that have a calmHubId', () => {
        const manifest = {
            'no-hub-id': { path: 'files/a.json', type: 'architecture' as const },
            'has-hub-id': { path: 'files/b.json', type: 'pattern' as const, calmHubId: '/calm/namespaces/ns/has-hub-id/versions/1.0.0' },
        };
        const rules = buildRefRules(manifest);
        expect(rules).toHaveLength(1);
        expect(rules[0].bareId).toBe('has-hub-id');
    });

    it('sets basePath to the path without the version segment', () => {
        const manifest = {
            doc: { path: 'files/doc.json', type: 'architecture' as const, calmHubId: '/calm/namespaces/ns/doc/versions/2.1.0' },
        };
        const [rule] = buildRefRules(manifest);
        expect(rule.targetPath).toBe('/calm/namespaces/ns/doc/versions/2.1.0');
        expect(rule.basePath).toBe('/calm/namespaces/ns/doc');
    });
});

// ─── resolveNewRef ───────────────────────────────────────────────────────────

describe('resolveNewRef', () => {
    const rules = buildRefRules({
        'workshop-pattern': {
            path: 'files/wp.json', type: 'pattern' as const,
            calmHubId: '/calm/namespaces/com.example/workshop-pattern/versions/1.2.0',
        },
    });

    it('replaces a bare document ID with the CalmHub path', () => {
        expect(resolveNewRef('workshop-pattern', rules))
            .toBe('/calm/namespaces/com.example/workshop-pattern/versions/1.2.0');
    });

    it('returns null when the ref already equals the target path', () => {
        expect(resolveNewRef('/calm/namespaces/com.example/workshop-pattern/versions/1.2.0', rules))
            .toBeNull();
    });

    it('updates a stale versioned path to the current version', () => {
        expect(resolveNewRef('/calm/namespaces/com.example/workshop-pattern/versions/1.0.0', rules))
            .toBe('/calm/namespaces/com.example/workshop-pattern/versions/1.2.0');
    });

    it('updates a stale full URL to the current version preserving the origin', () => {
        expect(resolveNewRef('https://hub.example.com/calm/namespaces/com.example/workshop-pattern/versions/1.0.0', rules))
            .toBe('https://hub.example.com/calm/namespaces/com.example/workshop-pattern/versions/1.2.0');
    });

    it('returns null for a full URL already at the correct version', () => {
        expect(resolveNewRef('https://hub.example.com/calm/namespaces/com.example/workshop-pattern/versions/1.2.0', rules))
            .toBeNull();
    });

    it('preserves fragment identifiers after replacement', () => {
        expect(resolveNewRef('workshop-pattern#/definitions/Node', rules))
            .toBe('/calm/namespaces/com.example/workshop-pattern/versions/1.2.0#/definitions/Node');

        expect(resolveNewRef('/calm/namespaces/com.example/workshop-pattern/versions/0.9.0#/Node', rules))
            .toBe('/calm/namespaces/com.example/workshop-pattern/versions/1.2.0#/Node');
    });

    it('returns null for unrelated refs', () => {
        expect(resolveNewRef('https://json-schema.org/draft-07/schema', rules)).toBeNull();
        expect(resolveNewRef('some-other-doc', rules)).toBeNull();
    });
});

// ─── updateWorkspaceRefs (integration) ───────────────────────────────────────

describe('updateWorkspaceRefs', () => {
    const testDir = path.join(__dirname, 'test-update-refs');
    const bundlePath = path.join(testDir, 'bundle');
    const filesPath = path.join(bundlePath, 'files');

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

    it('returns empty array and warns when no entries have a calmHubId', async () => {
        await saveManifest(bundlePath, {
            'doc-a': { path: 'files/doc-a.json', type: 'architecture' },
        });
        await writeFile(path.join(filesPath, 'doc-a.json'), JSON.stringify({ $id: 'doc-a' }));

        const results = await updateWorkspaceRefs(bundlePath);
        expect(results).toHaveLength(0);
    });

    it('replaces bare ID refs in documents', async () => {
        const patternDoc = { $id: 'my-pattern', title: 'Pattern' };
        const archDoc = { $id: 'my-arch', $schema: 'my-pattern' };

        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify(patternDoc));
        await writeFile(path.join(filesPath, 'arch.json'), JSON.stringify(archDoc));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'my-arch': {
                path: 'files/arch.json', type: 'architecture',
            },
        });

        const results = await updateWorkspaceRefs(bundlePath);

        const archResult = results.find(r => r.docId === 'my-arch');
        expect(archResult?.changeCount).toBe(1);

        const updatedArch = JSON.parse(await readFile(path.join(filesPath, 'arch.json'), 'utf8')) as Record<string, unknown>;
        expect(updatedArch.$schema).toBe('/calm/namespaces/ns/my-pattern/versions/1.0.0');
    });

    it('updates stale versioned paths to the current version', async () => {
        const patternDoc = { $id: 'my-pattern' };
        const archDoc = { $ref: '/calm/namespaces/ns/my-pattern/versions/0.9.0' };

        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify(patternDoc));
        await writeFile(path.join(filesPath, 'arch.json'), JSON.stringify(archDoc));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.1.0',
            },
            'my-arch': {
                path: 'files/arch.json', type: 'architecture',
            },
        });

        await updateWorkspaceRefs(bundlePath);

        const updated = JSON.parse(await readFile(path.join(filesPath, 'arch.json'), 'utf8')) as Record<string, unknown>;
        expect(updated.$ref).toBe('/calm/namespaces/ns/my-pattern/versions/1.1.0');
    });

    it('updates stale full URL refs preserving the origin', async () => {
        const archDoc = { $ref: 'https://hub.example.com/calm/namespaces/ns/my-pattern/versions/1.0.0' };

        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({ $id: 'my-pattern' }));
        await writeFile(path.join(filesPath, 'arch.json'), JSON.stringify(archDoc));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/2.0.0',
            },
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        await updateWorkspaceRefs(bundlePath);

        const updated = JSON.parse(await readFile(path.join(filesPath, 'arch.json'), 'utf8')) as Record<string, unknown>;
        expect(updated.$ref).toBe('https://hub.example.com/calm/namespaces/ns/my-pattern/versions/2.0.0');
    });

    it('handles JSON Schema const form', async () => {
        const archDoc = { properties: { schema: { $schema: { const: 'my-pattern' } } } };

        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({ $id: 'my-pattern' }));
        await writeFile(path.join(filesPath, 'arch.json'), JSON.stringify(archDoc));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        await updateWorkspaceRefs(bundlePath);

        const updated = JSON.parse(await readFile(path.join(filesPath, 'arch.json'), 'utf8')) as { properties: { schema: { $schema: { const: string } } } };
        expect(updated.properties.schema.$schema.const).toBe('/calm/namespaces/ns/my-pattern/versions/1.0.0');
    });

    it('does not write files in dry-run mode', async () => {
        const archDoc = { $ref: 'my-pattern' };
        const archPath = path.join(filesPath, 'arch.json');
        await writeFile(archPath, JSON.stringify(archDoc));
        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({ $id: 'my-pattern' }));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        const results = await updateWorkspaceRefs(bundlePath, { dryRun: true });

        // Reports the change but file is unchanged
        expect(results.find(r => r.docId === 'my-arch')?.changeCount).toBe(1);
        const onDisk = JSON.parse(await readFile(archPath, 'utf8')) as Record<string, unknown>;
        expect(onDisk.$ref).toBe('my-pattern');
    });

    it('skips missing files', async () => {
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'missing': { path: 'files/missing.json', type: 'architecture' },
        });

        const results = await updateWorkspaceRefs(bundlePath);
        expect(results.map(r => r.docId)).not.toContain('missing');
    });

    it('skips files with invalid JSON', async () => {
        await writeFile(path.join(filesPath, 'bad.json'), 'not json {{{');
        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({ $id: 'my-pattern' }));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'bad': { path: 'files/bad.json', type: 'architecture' },
        });

        await expect(updateWorkspaceRefs(bundlePath)).resolves.not.toThrow();
        expect(existsSync(path.join(filesPath, 'bad.json'))).toBe(true);
    });

    it('reports zero changeCount for documents that needed no updates', async () => {
        const archDoc = { $ref: '/calm/namespaces/ns/my-pattern/versions/1.0.0' };
        await writeFile(path.join(filesPath, 'pattern.json'), JSON.stringify({ $id: 'my-pattern' }));
        await writeFile(path.join(filesPath, 'arch.json'), JSON.stringify(archDoc));
        await saveManifest(bundlePath, {
            'my-pattern': {
                path: 'files/pattern.json', type: 'pattern',
                calmHubId: '/calm/namespaces/ns/my-pattern/versions/1.0.0',
            },
            'my-arch': { path: 'files/arch.json', type: 'architecture' },
        });

        const results = await updateWorkspaceRefs(bundlePath);
        expect(results.find(r => r.docId === 'my-arch')?.changeCount).toBe(0);
    });
});
