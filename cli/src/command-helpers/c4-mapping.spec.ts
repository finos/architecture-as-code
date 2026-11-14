import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalmHubClient, type DocumentLoader } from '@finos/calm-shared';
import { loadDocifyC4Mapping } from './c4-mapping';

const DEFAULT_URL = 'https://calm.finos.org/standards/c4/1.0/calm-default.c4-mapping.json';
const acme = { 'unique-id': 'acme', extends: DEFAULT_URL, 'node-types': { 'aws:lambda': 'container' } };
const hubArchitecture = { $id: 'https://hub.example.com/calm/namespaces/org.team/architectures/shop/versions/1.0.0' };

describe('loadDocifyC4Mapping', () => {
    let dir: string;
    let loader: DocumentLoader;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'c4-mapping-'));
        loader = { initialise: vi.fn(), loadMissingDocument: vi.fn(), resolvePath: vi.fn() };
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(dir, { recursive: true, force: true });
    });

    it('reads --c4-mapping from a file, on top of the default mapping it extends', async () => {
        const file = path.join(dir, 'acme.json');
        await writeFile(file, JSON.stringify(acme));

        const loaded = await loadDocifyC4Mapping({ flag: file, readArchitecture: async () => hubArchitecture }, loader);

        expect(loaded?.from).toBe(file);
        expect(loaded?.mapping['node-types']['aws:lambda'].kind).toBe('container');
        expect(loaded?.mapping['node-types'].actor.kind).toBe('person');
    });

    it('loads a --c4-mapping URL, and each URL it extends, with the document loader', async () => {
        vi.mocked(loader.loadMissingDocument).mockImplementation(async (url) =>
            url.endsWith('team.json') ? { 'unique-id': 'team', extends: 'https://example.com/org.json' } : { ...acme, 'unique-id': 'org' },
        );

        const loaded = await loadDocifyC4Mapping({ flag: 'https://example.com/team.json', readArchitecture: async () => ({}) }, loader);

        expect(vi.mocked(loader.loadMissingDocument).mock.calls.map(([url]) => url)).toEqual(['https://example.com/team.json', 'https://example.com/org.json']);
        expect(loaded?.mapping['unique-id']).toBe('team');
        expect(loaded?.mapping['node-types']['aws:lambda'].kind).toBe('container');
    });

    it('reads the workspace setting relative to the workspace root when there is no flag', async () => {
        await mkdir(path.join(dir, 'c4'));
        await writeFile(path.join(dir, 'c4', 'acme.json'), JSON.stringify(acme));
        const hubSpy = vi.spyOn(CalmHubClient.prototype, 'getNamespaceDefaultConfig');

        const loaded = await loadDocifyC4Mapping(
            { workspaceMapping: 'c4/acme.json', workspaceRoot: dir, readArchitecture: async () => hubArchitecture, hub: { calmHubUrl: 'https://hub.example.com' } },
            loader,
        );

        expect(loaded?.from).toBe('c4/acme.json (workspace setting)');
        expect(hubSpy).not.toHaveBeenCalled();
    });

    it('uses the namespace default of the CALM Hub the architecture came from', async () => {
        const hubSpy = vi.spyOn(CalmHubClient.prototype, 'getNamespaceDefaultConfig').mockResolvedValue({
            configType: 'c4-mapping', namespace: 'org', configId: 3, version: '1.1.0', inherited: true, config: acme,
        });

        const loaded = await loadDocifyC4Mapping({ readArchitecture: async () => hubArchitecture, hub: { calmHubUrl: 'https://hub.example.com/' } }, loader);

        expect(hubSpy).toHaveBeenCalledWith('org.team', 'c4-mapping');
        expect(loaded?.from).toBe('CALM Hub config 3 version 1.1.0 of namespace org');
        expect(loaded?.mapping['unique-id']).toBe('acme');
    });

    it.each([
        ['no namespace in the chain sets a default', hubArchitecture, 'https://hub.example.com'],
        ['the architecture comes from another CALM Hub', hubArchitecture, 'https://other.example.com'],
        ['the architecture has no CALM Hub $id', { $id: 'https://example.com/shop.json' }, 'https://hub.example.com'],
        ['the architecture cannot be read', undefined, 'https://hub.example.com'],
    ])('returns undefined, so the default mapping applies, when %s', async (_, architecture, calmHubUrl) => {
        vi.spyOn(CalmHubClient.prototype, 'getNamespaceDefaultConfig').mockResolvedValue(undefined);
        const readArchitecture = architecture ? async () => architecture : async () => Promise.reject(new Error('ENOENT'));

        await expect(loadDocifyC4Mapping({ readArchitecture, hub: { calmHubUrl } }, loader)).resolves.toBeUndefined();
    });

    it('returns undefined without reading the architecture when no CALM Hub is configured', async () => {
        const readArchitecture = vi.fn();

        await expect(loadDocifyC4Mapping({ readArchitecture }, loader)).resolves.toBeUndefined();
        expect(readArchitecture).not.toHaveBeenCalled();
    });

    it('fails on a mapping that is not valid', async () => {
        const file = path.join(dir, 'bad.json');
        await writeFile(file, JSON.stringify({ 'node-types': {} }));

        await expect(loadDocifyC4Mapping({ flag: file, readArchitecture: async () => ({}) }, loader)).rejects.toThrow('"unique-id" must be a non-empty string');
    });
});
