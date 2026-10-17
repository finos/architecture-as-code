import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { markAsSnapshot, releaseSnapshot, findSnapshotDependencies, findSnapshotDependencyViolations, listSnapshotCandidates } from './snapshot';
import { saveManifest } from './bundle';
import { CalmHubClient } from '@finos/calm-shared';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('@finos/calm-shared', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@finos/calm-shared')>()),
    initLogger: () => logger,
}));

const BASE = 'https://hub.example.com';
const idAt = (resource: string, version: string, type = 'architectures', ns = 'com.example') =>
    `${BASE}/calm/namespaces/${ns}/${type}/${resource}/versions/${version}`;

const makeClient = (versions: Record<string, string[]> = {}): CalmHubClient => ({
    getMappedResourceVersions: vi.fn(async (_ns: string, mappingId: string) => versions[mappingId] ?? []),
}) as unknown as CalmHubClient;

describe('snapshot', () => {
    const bundlePath = path.join(__dirname, 'test-snapshot', 'bundle');
    const filesPath = path.join(bundlePath, 'files');

    beforeAll(async () => { await mkdir(filesPath, { recursive: true }); });
    afterAll(async () => { await rm(path.join(__dirname, 'test-snapshot'), { recursive: true, force: true }); });
    beforeEach(async () => {
        await rm(bundlePath, { recursive: true, force: true });
        await mkdir(filesPath, { recursive: true });
        vi.clearAllMocks();
    });

    const write = (name: string, obj: object) =>
        writeFile(path.join(filesPath, name), JSON.stringify(obj, null, 2), 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const read = async (name: string): Promise<any> => JSON.parse(await readFile(path.join(filesPath, name), 'utf8'));

    describe('markAsSnapshot', () => {
        it('snapshots in place when the on-disk version is not yet published', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await markAsSnapshot(bundlePath, 'a', makeClient({}), { increment: 'MINOR' });

            expect(result).toMatchObject({ id: 'a', fromVersion: '1.0.0', toVersion: '1.0.0-SNAPSHOT' });
            const updated = await read('a.json');
            expect(updated['$id']).toBe(idAt('a', '1.0.0-SNAPSHOT'));
        });

        it('bumps first (per increment) when the on-disk version is already published', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            expect(result).toMatchObject({ id: 'a', fromVersion: '1.0.0', toVersion: '1.1.0-SNAPSHOT' });
            const updated = await read('a.json');
            expect(updated['$id']).toBe(idAt('a', '1.1.0-SNAPSHOT'));
        });

        it('bumps from the hub\'s latest published version, not the on-disk version, to avoid colliding with a version someone else already published', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0', '1.1.0'] }), { increment: 'MINOR' });

            expect(result.toVersion).toBe('1.2.0-SNAPSHOT');
        });

        it('warns when the snapshot version already exists in CalmHub', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0', '1.1.0-SNAPSHOT'] }), { increment: 'MINOR' });

            expect(result.toVersion).toBe('1.1.0-SNAPSHOT');
            expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/1\.1\.0-SNAPSHOT .*already exists/));
        });

        it('does not warn when the snapshot version is new to CalmHub', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('respects the requested increment when bumping', async () => {
            await write('a.json', { $id: idAt('a', '1.2.3'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.2.3'] }), { increment: 'MAJOR' });

            expect(result.toVersion).toBe('2.0.0-SNAPSHOT');
        });

        it('throws when the document is already a snapshot', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            await expect(markAsSnapshot(bundlePath, 'a', makeClient({}), { increment: 'MINOR' }))
                .rejects.toThrow(/already a snapshot/);
        });

        it('throws when the id is not tracked', async () => {
            await saveManifest(bundlePath, {});
            await expect(markAsSnapshot(bundlePath, 'missing', makeClient({}), { increment: 'MINOR' }))
                .rejects.toThrow(/No document with id 'missing'/);
        });

        it('throws when the tracked file does not exist on disk', async () => {
            await saveManifest(bundlePath, { 'a': { path: 'files/missing.json', type: 'architecture' } });
            await expect(markAsSnapshot(bundlePath, 'a', makeClient({}), { increment: 'MINOR' }))
                .rejects.toThrow(/File not found for id 'a'/);
        });

        it('throws with a helpful message when the document has no conformant $id', async () => {
            await write('a.json', { title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });
            await expect(markAsSnapshot(bundlePath, 'a', makeClient({}), { increment: 'MINOR' }))
                .rejects.toThrow(/not mappable to CalmHub/);
        });

        it('does not repoint an already-published (release) document that references this one', async () => {
            // B is a release: relinking it here would change its content without a version
            // bump, silently diverging it from what's already published.
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            const updatedB = await read('b.json');
            expect(updatedB.interfaces[0]['$ref']).toBe(idAt('a', '1.0.0'));
        });

        it('repoints another snapshot document that references this one', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            const updatedB = await read('b.json');
            expect(updatedB.interfaces[0]['$ref']).toBe(idAt('a', '1.1.0-SNAPSHOT'));
        });
        it('relinks references when the manifest also has an unsupported entry', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await writeFile(path.join(bundlePath, 'workspace-manifest.json'), JSON.stringify({
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
                'future': { path: 'files/future.json', type: 'future-document-kind' },
            }));

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            expect((await read('a.json'))['$id']).toBe(idAt('a', '1.1.0-SNAPSHOT'));
            expect((await read('b.json')).interfaces[0]['$ref']).toBe(idAt('a', '1.1.0-SNAPSHOT'));
        });
    });

    describe('listSnapshotCandidates', () => {
        it('splits mappable documents into releases and snapshots, leaving out the rest', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B' });
            await write('c.json', { $id: 'bare-id', title: 'C' });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
                'c': { path: 'files/c.json', type: 'architecture' },
                'missing': { path: 'files/missing.json', type: 'architecture' },
            });

            expect(await listSnapshotCandidates(bundlePath)).toEqual({ releases: ['a'], snapshots: ['b'] });
        });
    });

    describe('flows', () => {
        // A CALM flow has a name and no title.
        const flowAt = (version: string) => ({
            $id: idAt('f', version, 'flows'),
            'unique-id': 'f',
            name: 'F',
            transitions: [{ 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'A calls B' }],
        });

        it('snapshots and releases a flow, keeping it name-only', async () => {
            await write('f.json', flowAt('1.0.0'));
            await saveManifest(bundlePath, { 'f': { path: 'files/f.json', type: 'flow' } });
            const client = makeClient({ f: ['1.0.0'] });

            const snapshot = await markAsSnapshot(bundlePath, 'f', client, { increment: 'MINOR' });
            expect(snapshot.toVersion).toBe('1.1.0-SNAPSHOT');
            expect(client.getMappedResourceVersions).toHaveBeenCalledWith('com.example', 'f', 'flows');
            expect(await read('f.json')).toEqual(flowAt('1.1.0-SNAPSHOT'));

            const release = await releaseSnapshot(bundlePath, 'f', client);
            expect(release.toVersion).toBe('1.1.0');
            expect(await read('f.json')).toEqual(flowAt('1.1.0'));
        });
    });

    describe('releaseSnapshot', () => {
        it('strips the -SNAPSHOT suffix', async () => {
            await write('a.json', { $id: idAt('a', '1.1.0-SNAPSHOT'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await releaseSnapshot(bundlePath, 'a', makeClient({}));

            expect(result).toMatchObject({ id: 'a', fromVersion: '1.1.0-SNAPSHOT', toVersion: '1.1.0' });
            const updated = await read('a.json');
            expect(updated['$id']).toBe(idAt('a', '1.1.0'));
        });

        it('throws when the document is not currently a snapshot', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            await expect(releaseSnapshot(bundlePath, 'a', makeClient({}))).rejects.toThrow(/not currently a snapshot/);
        });

        it('is blocked by a snapshot dependency', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await expect(releaseSnapshot(bundlePath, 'b', makeClient({}))).rejects.toThrow(/depends on snapshot version\(s\) of a/);
        });

        it('is blocked by a ref to a snapshot of an untracked resource', async () => {
            const untracked = idAt('other', '2.0.0-SNAPSHOT', 'patterns');
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': untracked }] });
            await saveManifest(bundlePath, { 'b': { path: 'files/b.json', type: 'architecture' } });

            await expect(releaseSnapshot(bundlePath, 'b', makeClient({}))).rejects.toThrow(/pin a released version/);
            expect((await read('b.json'))['$id']).toBe(idAt('b', '1.1.0-SNAPSHOT'));
        });

        it('succeeds once the dependency is released first', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await releaseSnapshot(bundlePath, 'a', makeClient({}));
            const result = await releaseSnapshot(bundlePath, 'b', makeClient({}));

            expect(result.toVersion).toBe('1.1.0');
        });

        it('refuses to release when the release version is already published (e.g. by someone else)', async () => {
            await write('a.json', { $id: idAt('a', '1.1.0-SNAPSHOT'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            await expect(releaseSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0', '1.1.0'] })))
                .rejects.toThrow(/version 1\.1\.0 already exists/);
        });
    });

    describe('findSnapshotDependencies', () => {
        it('returns ids of referenced tracked documents that are still snapshots', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual(['a']);
        });

        it('returns an empty list when no referenced documents are snapshots', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('resolves a bare-id $ref (not a full CalmHub URL) to its tracked document', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': 'a' }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual(['a']);
        });

        it('ignores a $ref that does not resolve to any tracked document', async () => {
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': 'https://elsewhere.example.com/schema.json' }] });
            await saveManifest(bundlePath, { 'b': { path: 'files/b.json', type: 'architecture' } });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('reports a ref pinned to a snapshot of an untracked resource', async () => {
            const untracked = idAt('other', '2.0.0-SNAPSHOT', 'patterns');
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': `${untracked}#/nodes` }] });
            await saveManifest(bundlePath, { 'b': { path: 'files/b.json', type: 'architecture' } });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([untracked]);
        });

        it('ignores a ref pinned to a release of an untracked resource', async () => {
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('other', '2.0.0', 'patterns') }] });
            await saveManifest(bundlePath, { 'b': { path: 'files/b.json', type: 'architecture' } });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('returns an empty list when the source document itself is not valid JSON', async () => {
            await writeFile(path.join(filesPath, 'b.json'), 'not json {{{', 'utf8');
            await saveManifest(bundlePath, { 'b': { path: 'files/b.json', type: 'architecture' } });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('skips a referenced target that is not mappable (no title) without throwing', async () => {
            await write('a.json', { $id: 'a' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': 'a' }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('returns an empty list for an untracked id', async () => {
            await saveManifest(bundlePath, {});
            expect(await findSnapshotDependencies(bundlePath, 'missing')).toEqual([]);
        });

        it('does not flag a ref pinned to an old release even though the target is now a snapshot', async () => {
            // b deliberately pins a's stable 1.0.0 — a moving on to 1.1.0-SNAPSHOT doesn't change
            // what b actually depends on.
            await write('a.json', { $id: idAt('a', '1.1.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual([]);
        });

        it('flags a ref pinned to the release that a snapshot target will become', async () => {
            await write('a.json', { $id: idAt('a', '1.1.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.1'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.1.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual(['a']);
        });

        it('resolves a full-URL ref against a target whose $id is a bare path', async () => {
            await write('a.json', { $id: '/calm/namespaces/com.example/architectures/a/versions/1.0.0-SNAPSHOT', title: 'A' });
            await write('b.json', {
                $id: idAt('b', '1.0.0'),
                title: 'B',
                'interfaces': [{ '$ref': `${BASE}/calm/namespaces/com.example/architectures/a/versions/1.0.0-SNAPSHOT` }],
            });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencies(bundlePath, 'b')).toEqual(['a']);
        });
    });

    describe('findSnapshotDependencyViolations', () => {
        it('reports a non-snapshot document that references a snapshot', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            const violations = await findSnapshotDependencyViolations(bundlePath);

            expect(violations).toEqual([{ id: 'b', dependsOn: ['a'] }]);
        });

        it('does not flag a snapshot document for referencing another snapshot', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencyViolations(bundlePath)).toEqual([]);
        });

        it('reports a release whose cascaded ref targets a document then snapshotted in place', async () => {
            // `workspace bump` moved a to 1.1.0 and cascaded b to it; neither is pushed yet.
            await write('a.json', { $id: idAt('a', '1.1.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.1'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.1.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'], b: ['1.0.0'] }), { increment: 'MINOR' });

            expect((await read('b.json')).interfaces[0].$ref).toBe(idAt('a', '1.1.0'));
            expect(await findSnapshotDependencyViolations(bundlePath)).toEqual([{ id: 'b', dependsOn: ['a'] }]);
        });

        it('returns an empty list for a workspace with no snapshots', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            expect(await findSnapshotDependencyViolations(bundlePath)).toEqual([]);
        });

        it('skips manifest entries whose file is missing or unmappable', async () => {
            await write('b.json', { title: 'B, no $id' });
            await saveManifest(bundlePath, {
                'missing': { path: 'files/does-not-exist.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            expect(await findSnapshotDependencyViolations(bundlePath)).toEqual([]);
        });
    });
});
