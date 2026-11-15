import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubClient, Problem } from './hub.js';
import { architecturePath, detailedArchitecturePath, loadC4Model } from './model.js';
import { SHOP, calmNode } from './testing.js';

const HOSTS = new Set(['calmhub', 'hub.example.org']);

/** A Hub with these paths. Each other path is a 404. */
function hubWith(paths: Record<string, unknown>) {
    const hub = new HubClient('http://calmhub:8080');
    const get = vi.spyOn(hub, 'get').mockImplementation(async (path) => paths[path]);
    return { source: { hub, hubHosts: HOSTS, mappingHosts: new Set(['mappings.example.org']) }, get };
}

const mappingDefault = (convention: object) => ({ namespace: 'finos', conventionId: 3, version: '1.0.0', inherited: false, convention });
const DEFAULT_PATH = '/api/calm/namespaces/finos/conventions/c4-mapping/default';

afterEach(() => vi.unstubAllGlobals());

describe('architecturePath', () => {
    it('reads a numeric id from the API and a custom id from the mapping API, with each part encoded', () => {
        expect(architecturePath('finos', '7', '1.0.0')).toBe('/api/calm/namespaces/finos/architectures/7/versions/1.0.0');
        expect(architecturePath('finos', 'my shop', '1.0.0')).toBe('/calm/namespaces/finos/architectures/my%20shop/versions/1.0.0');
    });
});

describe('detailedArchitecturePath', () => {
    it('follows a link to an architecture in the same namespace on this Hub only', () => {
        expect(detailedArchitecturePath('/calm/namespaces/finos/architectures/9/versions/1.0.0', 'finos', HOSTS)).toBe('/api/calm/namespaces/finos/architectures/9/versions/1.0.0');
        expect(detailedArchitecturePath('https://hub.example.org/calm/namespaces/finos/architectures/api/versions/2.0.0', 'finos', HOSTS))
            .toBe('/calm/namespaces/finos/architectures/api/versions/2.0.0');
        expect(detailedArchitecturePath('/calm/namespaces/secret/architectures/9/versions/1.0.0', 'finos', HOSTS)).toBeUndefined();
        expect(detailedArchitecturePath('https://elsewhere.example.org/calm/namespaces/finos/architectures/9/versions/1.0.0', 'finos', HOSTS)).toBeUndefined();
    });
});

describe('loadC4Model', () => {
    it('projects the architecture with the default mapping when the namespace sets none', async () => {
        const { source } = hubWith({ '/api/calm/namespaces/finos/architectures/7/versions/1.0.0': SHOP });
        const { model, mapping } = await loadC4Model(source, 'finos', '7', '1.0.0');
        expect(mapping).toEqual({ id: 'calm-default-c4-mapping' });
        expect(model.elements.get('api')?.kind).toBe('container');
    });

    it('adds a detailed architecture in the same namespace, and does not read one in another namespace', async () => {
        const architecture = {
            nodes: [
                calmNode('shop', 'system'),
                calmNode('api', 'service', { details: { 'detailed-architecture': '/calm/namespaces/finos/architectures/9/versions/1.0.0' } }),
                calmNode('db', 'database', { details: { 'detailed-architecture': '/calm/namespaces/secret/architectures/1/versions/1.0.0' } }),
            ],
            relationships: [{ 'unique-id': 'c', 'relationship-type': { 'composed-of': { container: 'shop', nodes: ['api', 'db'] } } }],
        };
        const { source, get } = hubWith({
            '/api/calm/namespaces/finos/architectures/7/versions/1.0.0': architecture,
            '/api/calm/namespaces/finos/architectures/9/versions/1.0.0': { nodes: [calmNode('orders', 'x:module')] },
        });
        const { model } = await loadC4Model(source, 'finos', '7', '1.0.0');
        expect(model.elements.get('api/orders')).toMatchObject({ kind: 'component', parent: 'api' });
        expect(get.mock.calls.map(([path]) => path)).not.toContain('/api/calm/namespaces/secret/architectures/1/versions/1.0.0');
    });

    it('resolves a mapping that extends a mapping on this Hub', async () => {
        const { source } = hubWith({
            '/api/calm/namespaces/finos/architectures/7/versions/1.0.0': SHOP,
            [DEFAULT_PATH]: mappingDefault({ 'unique-id': 'team', extends: 'http://hub.example.org/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0', 'node-types': { 'x:mailer': 'software-system' } }),
            '/api/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0': { 'unique-id': 'org', 'node-types': { service: 'container', system: 'software-system' } },
        });
        const { model, mapping } = await loadC4Model(source, 'finos', '7', '1.0.0');
        expect(mapping).toEqual({ id: 'team', namespace: 'finos', conventionId: 3, version: '1.0.0', inherited: false });
        expect(model.elements.get('mailer')?.source).toBe('mapping');
    });

    it('refuses to fetch a mapping from a host that the operator does not allow', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const { source } = hubWith({
            '/api/calm/namespaces/finos/architectures/7/versions/1.0.0': SHOP,
            [DEFAULT_PATH]: mappingDefault({ 'unique-id': 'team', extends: 'http://169.254.169.254/latest/meta-data' }),
        });
        await expect(loadC4Model(source, 'finos', '7', '1.0.0')).rejects.toMatchObject({
            status: 422, title: 'The C4 mapping of the namespace does not load', detail: expect.stringContaining('CALM_C4_MAPPING_HOSTS'),
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches a mapping from an allowed host over https, without credentials', async () => {
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ 'unique-id': 'shared', 'node-types': { service: 'container' } })));
        vi.stubGlobal('fetch', fetch);
        const { source } = hubWith({
            '/api/calm/namespaces/finos/architectures/7/versions/1.0.0': SHOP,
            [DEFAULT_PATH]: mappingDefault({ 'unique-id': 'team', extends: 'https://mappings.example.org/shared.json' }),
        });
        await loadC4Model(source, 'finos', '7', '1.0.0');
        expect(fetch).toHaveBeenCalledWith(new URL('https://mappings.example.org/shared.json'), expect.not.objectContaining({ headers: expect.anything() }));
    });

    it('says which architecture CALM Hub does not have', async () => {
        const { source } = hubWith({});
        const error = await loadC4Model(source, 'finos', '7', '9.9.9').catch((e: Problem) => e);
        expect(error).toMatchObject({ status: 404, detail: 'finos/7 version 9.9.9' });
    });
});
