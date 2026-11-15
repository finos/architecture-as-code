import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildC4Model, type HubData } from './model.js';
import { Problem } from './problem.js';
import { SHOP, calmNode } from './testing.js';

const mappingDefault = (convention: object) => ({ 'c4-mapping': { namespace: 'finos', conventionId: 3, version: '1.0.0', inherited: false, convention } });
const HOSTS = new Set(['mappings.example.org']);

afterEach(() => vi.unstubAllGlobals());

describe('buildC4Model', () => {
    it('projects the architecture with the default mapping when the namespace sets none', async () => {
        const { model, mapping } = await buildC4Model({ document: SHOP }, 'finos', '7');
        expect(mapping).toEqual({ id: 'calm-default-c4-mapping' });
        expect(model.elements.get('api')?.kind).toBe('container');
    });

    it('adds the detailed architectures that Hub sent, and only those', async () => {
        const link = '/calm/namespaces/finos/architectures/9/versions/1.0.0';
        const data: HubData = {
            document: {
                nodes: [
                    calmNode('shop', 'system'),
                    calmNode('api', 'service', { details: { 'detailed-architecture': link } }),
                    calmNode('db', 'database', { details: { 'detailed-architecture': '/calm/namespaces/secret/architectures/1/versions/1.0.0' } }),
                ],
                relationships: [{ 'unique-id': 'c', 'relationship-type': { 'composed-of': { container: 'shop', nodes: ['api', 'db'] } } }],
            },
            linked: { [link]: { nodes: [calmNode('orders', 'x:module')] } },
        };
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const { model, calmIds } = await buildC4Model(data, 'finos', '7');
        expect(model.elements.get('api/orders')).toMatchObject({ kind: 'component', parent: 'api' });
        expect([...model.elements.keys()].filter((id) => id.startsWith('db/'))).toEqual([]);
        expect(calmIds.has('api/orders')).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('resolves a mapping that extends a mapping on Hub, from what Hub sent', async () => {
        const parent = 'http://hub.example.org/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0';
        const data: HubData = {
            document: SHOP,
            conventions: mappingDefault({ 'unique-id': 'team', extends: parent, 'node-types': { 'x:mailer': 'software-system' } }),
            linked: { [parent]: { 'unique-id': 'org', 'node-types': { service: 'container', system: 'software-system' } } },
        };
        const { model, mapping } = await buildC4Model(data, 'finos', '7');
        expect(mapping).toEqual({ id: 'team', namespace: 'finos', conventionId: 3, version: '1.0.0', inherited: false });
        expect(model.elements.get('mailer')?.source).toBe('mapping');
    });

    it('refuses to fetch a mapping from a host that the operator does not allow', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const data = { document: SHOP, conventions: mappingDefault({ 'unique-id': 'team', extends: 'http://169.254.169.254/latest/meta-data' }) };
        await expect(buildC4Model(data, 'finos', '7', HOSTS)).rejects.toMatchObject({
            status: 422, title: 'The C4 mapping of the namespace does not load', detail: expect.stringContaining('CALM_C4_MAPPING_HOSTS'),
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('refuses an allowed host on another port, a mapping that is too large, and a chain that is too long', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const port = { document: SHOP, conventions: mappingDefault({ 'unique-id': 'team', extends: 'https://mappings.example.org:22/x.json' }) };
        await expect(buildC4Model(port, 'finos', '7', HOSTS)).rejects.toMatchObject({ status: 422 });
        expect(fetch).not.toHaveBeenCalled();

        // An endless body: the read must stop at the cap and cancel the download.
        let cancelled = false;
        let sent = 0;
        const endless = new ReadableStream<Uint8Array>({
            pull(controller) { sent += 65_536; controller.enqueue(new Uint8Array(65_536).fill(32)); },
            cancel() { cancelled = true; },
        });
        fetch.mockResolvedValue(new Response(endless));
        const big = { document: SHOP, conventions: mappingDefault({ 'unique-id': 'team', extends: 'https://mappings.example.org/big.json' }) };
        await expect(buildC4Model(big, 'finos', '7', HOSTS)).rejects.toMatchObject({ detail: expect.stringContaining('larger than') });
        expect(cancelled).toBe(true);
        expect(sent).toBeLessThan(2 * 1024 * 1024);

        let n = 0;
        fetch.mockImplementation(async () => new Response(JSON.stringify({ 'unique-id': `m${++n}`, extends: `https://mappings.example.org/${n}.json` })));
        const chain = { document: SHOP, conventions: mappingDefault({ 'unique-id': 'team', extends: 'https://mappings.example.org/0.json' }) };
        await expect(buildC4Model(chain, 'finos', '7', HOSTS)).rejects.toMatchObject({ detail: expect.stringContaining('more than 8') });
        expect(fetch).toHaveBeenCalledTimes(1 + 8);
    });

    it('fetches a mapping from an allowed host over https, without credentials', async () => {
        const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ 'unique-id': 'shared', 'node-types': { service: 'container' } })));
        vi.stubGlobal('fetch', fetch);
        const data = { document: SHOP, conventions: mappingDefault({ 'unique-id': 'team', extends: 'https://mappings.example.org/shared.json' }) };
        await buildC4Model(data, 'finos', '7', HOSTS);
        expect(fetch).toHaveBeenCalledWith(new URL('https://mappings.example.org/shared.json'), expect.not.objectContaining({ headers: expect.anything() }));
    });

    it('says what is wrong when Hub sent no architecture', async () => {
        const error = await buildC4Model({}, 'finos', '7').catch((e: Problem) => e);
        expect(error).toMatchObject({ status: 400, title: 'CALM Hub sent no architecture' });
    });
});
