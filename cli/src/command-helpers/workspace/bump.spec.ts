import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { detectChangedResources, bumpWorkspace, canonicalEqual, maxIncrement } from './bump';
import { loadManifest, saveManifest } from './bundle';
import { CalmHubClient, ResourceChangeType } from '@finos/calm-shared/src/hub/calm-hub-client';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';

vi.mock('@finos/calm-shared/src/logger', () => ({
    initLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

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
