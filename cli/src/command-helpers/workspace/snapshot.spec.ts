import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { markAsSnapshot, releaseSnapshot, findSnapshotDependencies, findSnapshotDependencyViolations } from './snapshot';
import { saveManifest } from './bundle';
import { CalmHubClient } from '@finos/calm-shared';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';

vi.mock('@finos/calm-shared', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@finos/calm-shared')>()),
    initLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
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

        it('repoints other tracked documents that reference this one at the new $id', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.0.0'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await markAsSnapshot(bundlePath, 'a', makeClient({ a: ['1.0.0'] }), { increment: 'MINOR' });

            const updatedB = await read('b.json');
            expect(updatedB.interfaces[0]['$ref']).toBe(idAt('a', '1.1.0-SNAPSHOT'));
        });
    });

    describe('releaseSnapshot', () => {
        it('strips the -SNAPSHOT suffix', async () => {
            await write('a.json', { $id: idAt('a', '1.1.0-SNAPSHOT'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            const result = await releaseSnapshot(bundlePath, 'a');

            expect(result).toMatchObject({ id: 'a', fromVersion: '1.1.0-SNAPSHOT', toVersion: '1.1.0' });
            const updated = await read('a.json');
            expect(updated['$id']).toBe(idAt('a', '1.1.0'));
        });

        it('throws when the document is not currently a snapshot', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0'), title: 'A' });
            await saveManifest(bundlePath, { 'a': { path: 'files/a.json', type: 'architecture' } });

            await expect(releaseSnapshot(bundlePath, 'a')).rejects.toThrow(/not currently a snapshot/);
        });

        it('is blocked by a snapshot dependency', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await expect(releaseSnapshot(bundlePath, 'b')).rejects.toThrow(/depends on snapshot version\(s\) of a/);
        });

        it('succeeds once the dependency is released first', async () => {
            await write('a.json', { $id: idAt('a', '1.0.0-SNAPSHOT'), title: 'A' });
            await write('b.json', { $id: idAt('b', '1.1.0-SNAPSHOT'), title: 'B', 'interfaces': [{ '$ref': idAt('a', '1.0.0-SNAPSHOT') }] });
            await saveManifest(bundlePath, {
                'a': { path: 'files/a.json', type: 'architecture' },
                'b': { path: 'files/b.json', type: 'architecture' },
            });

            await releaseSnapshot(bundlePath, 'a');
            const result = await releaseSnapshot(bundlePath, 'b');

            expect(result.toVersion).toBe('1.1.0');
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
