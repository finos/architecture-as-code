import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
    stripVersionSuffix,
    resolveNewRef,
    buildRefRulesFromDiskIds,
    syncReferences,
    RefRule,
} from './ref-rewrite';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadJson = async (p: string): Promise<any> => JSON.parse(await readFile(p, 'utf8'));

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const BASE = 'https://hub.example.com';
const idAt = (resource: string, version: string, type = 'architectures', ns = 'com.example') =>
    `${BASE}/calm/namespaces/${ns}/${type}/${resource}/versions/${version}`;

describe('ref-rewrite pure functions', () => {
    describe('stripVersionSuffix', () => {
        it('strips a /versions/<v> suffix to the base path', () => {
            expect(stripVersionSuffix(idAt('a', '1.0.0'))).toBe(`${BASE}/calm/namespaces/com.example/architectures/a`);
        });
        it('returns null when there is no version segment', () => {
            expect(stripVersionSuffix('some-bare-id')).toBeNull();
        });
    });

    describe('resolveNewRef', () => {
        const rules: RefRule[] = [{
            bareId: 'doc-a',
            targetPath: idAt('a', '1.1.0'),
            basePath: stripVersionSuffix(idAt('a', '1.1.0')),
        }];

        it('repoints a stale full URL to the target, preserving the fragment', () => {
            expect(resolveNewRef(idAt('a', '1.0.0') + '#/node/x', rules)).toBe(idAt('a', '1.1.0') + '#/node/x');
        });
        it('repoints a bare id to the target', () => {
            expect(resolveNewRef('doc-a', rules)).toBe(idAt('a', '1.1.0'));
        });
        it('returns null when the ref is already at the target', () => {
            expect(resolveNewRef(idAt('a', '1.1.0'), rules)).toBeNull();
        });
        it('returns null for an unrelated ref', () => {
            expect(resolveNewRef(idAt('other', '1.0.0'), rules)).toBeNull();
        });

        it('repoints a full-URL ref when the rule basePath is a bare path', () => {
            const pathRules: RefRule[] = [{
                bareId: 'doc-a',
                targetPath: '/calm/namespaces/com.example/architectures/a/versions/1.1.0',
                basePath: '/calm/namespaces/com.example/architectures/a',
            }];
            expect(resolveNewRef('https://other-host.example.com/calm/namespaces/com.example/architectures/a/versions/1.0.0', pathRules))
                .toBe('https://other-host.example.com/calm/namespaces/com.example/architectures/a/versions/1.1.0');
        });

        it('repoints a full-URL ref when both rule and ref use full URLs with the same origin', () => {
            // $id is a full URL — should match same-host refs and update only the version.
            const fullUrlRules: RefRule[] = [{
                bareId: 'doc-a',
                targetPath: idAt('a', '1.1.0'),
                basePath: stripVersionSuffix(idAt('a', '1.1.0')),
            }];
            expect(resolveNewRef(idAt('a', '1.0.0'), fullUrlRules)).toBe(idAt('a', '1.1.0'));
        });

        it('does not repoint a full-URL ref when the origin differs from the full-URL rule', () => {
            const fullUrlRules: RefRule[] = [{
                bareId: 'doc-a',
                targetPath: idAt('a', '1.1.0'),
                basePath: stripVersionSuffix(idAt('a', '1.1.0')),
            }];
            const differentHost = 'https://other.example.com/calm/namespaces/com.example/architectures/a/versions/1.0.0';
            expect(resolveNewRef(differentHost, fullUrlRules)).toBeNull();
        });

        it('repoints an unversioned bare-path ref to the target', () => {
            const pathRules: RefRule[] = [{
                bareId: 'doc-a',
                targetPath: '/calm/namespaces/com.example/architectures/a/versions/1.1.0',
                basePath: '/calm/namespaces/com.example/architectures/a',
            }];
            expect(resolveNewRef('/calm/namespaces/com.example/architectures/a', pathRules))
                .toBe('/calm/namespaces/com.example/architectures/a/versions/1.1.0');
        });
    });
});

describe('ref-rewrite orchestrators', () => {
    const bundlePath = path.join(__dirname, 'test-refrewrite');

    beforeAll(async () => { await mkdir(bundlePath, { recursive: true }); });
    afterAll(async () => { await rm(bundlePath, { recursive: true, force: true }); });
    beforeEach(async () => {
        await rm(bundlePath, { recursive: true, force: true });
        await mkdir(path.join(bundlePath, 'files'), { recursive: true });
    });

    const write = (name: string, obj: object) =>
        writeFile(path.join(bundlePath, 'files', name), JSON.stringify(obj, null, 2), 'utf8');

    it('builds rules from each tracked doc current $id and skips docs without a usable $id', async () => {
        await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
        await write('b.json', { title: 'B (no $id)' });
        const manifest = {
            'a': { path: 'files/a.json', type: 'architecture' as const },
            'b': { path: 'files/b.json', type: 'architecture' as const },
        };
        const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
        expect(rules).toHaveLength(1);
        expect(rules[0]).toMatchObject({ bareId: 'a', targetPath: idAt('a', '1.1.0') });
    });

    it('rewrites references across tracked docs to the current $id (fragment preserved) and is idempotent', async () => {
        await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
        await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', nodes: [{ $ref: idAt('a', '1.0.0') + '#/x' }] });
        const manifest = {
            'a': { path: 'files/a.json', type: 'architecture' as const },
            'b': { path: 'files/b.json', type: 'architecture' as const },
        };

        const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
        const results = await syncReferences(bundlePath, manifest, rules);

        const b = await loadJson(path.join(bundlePath, 'files', 'b.json'));
        expect(b.nodes[0].$ref).toBe(idAt('a', '1.1.0') + '#/x');
        expect(results.find(r => r.docId === 'b')!.changeCount).toBe(1);

        // Second run: nothing left to change
        const rerun = await syncReferences(bundlePath, manifest, rules);
        expect(rerun.every(r => r.changeCount === 0)).toBe(true);
    });

    it('rewrites a JSON-schema const reference form', async () => {
        await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
        await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', $schema: { const: idAt('a', '1.0.0') } });
        const manifest = {
            'a': { path: 'files/a.json', type: 'architecture' as const },
            'b': { path: 'files/b.json', type: 'architecture' as const },
        };
        const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
        await syncReferences(bundlePath, manifest, rules);

        const b = await loadJson(path.join(bundlePath, 'files', 'b.json'));
        expect(b.$schema.const).toBe(idAt('a', '1.1.0'));
    });

    it('skips missing files and unparseable JSON when building rules and syncing', async () => {
        await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
        await writeFile(path.join(bundlePath, 'files', 'bad.json'), 'not json {{{', 'utf8');
        const manifest = {
            'a': { path: 'files/a.json', type: 'architecture' as const },
            'bad': { path: 'files/bad.json', type: 'architecture' as const },
            'missing': { path: 'files/missing.json', type: 'architecture' as const },
        };
        const rules = await buildRefRulesFromDiskIds(manifest, bundlePath);
        expect(rules).toHaveLength(1); // only 'a' yields a rule

        const results = await syncReferences(bundlePath, manifest, rules);
        // only 'a' is processed; bad/missing are skipped
        expect(results.map(r => r.docId)).toEqual(['a']);
    });
});
