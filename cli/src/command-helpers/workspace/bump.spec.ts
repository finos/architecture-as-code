import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { detectChangedResources, bumpWorkspace, canonicalEqual } from './bump';
import { saveManifest } from './bundle';
import { CalmHubClient } from '@finos/calm-shared/src/hub/calm-hub-client';
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
}
const makeClient = (opts: ClientOpts = {}): CalmHubClient => ({
    getMappedResourceVersions: vi.fn(async (_ns: string, mappingId: string) => opts.versions?.[mappingId] ?? []),
    getMappedResourceByVersion: vi.fn(async (_ns: string, mappingId: string, version: string) => opts.remote?.[`${mappingId}@${version}`] ?? {}),
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
    });
});
