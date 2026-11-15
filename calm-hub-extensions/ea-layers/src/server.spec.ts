import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { architecturePath, createLayersServer, exportExtension } from './server.js';
import { SHOP } from './testing.js';

const ISSUER = 'http://hub.test';
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig' }] };

let hub: Server;
let service: Server;
let base: string;
const hubAuthorizations: (string | undefined)[] = [];

async function listen(server: Server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
    hub = createServer((req, res) => {
        const json = (status: number, body?: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(body === undefined ? undefined : JSON.stringify(body));
        if (req.url === '/api/calm/auth/jwks') return json(200, jwks);
        if (req.url === '/token') return json(200, { access_token: 'service-token', expires_in: 300 });
        hubAuthorizations.push(req.headers.authorization);
        if (req.url === '/api/calm/namespaces/finos/architectures/7/versions/1.0.0') return json(200, SHOP);
        return json(404, {});
    });
    const hubUrl = await listen(hub);
    service = createLayersServer({ hubUrl, issuer: ISSUER, account: { tokenUrl: `${hubUrl}/token`, clientId: 'ea-layers', clientSecret: 'secret' } });
    base = await listen(service);
});

afterAll(() => {
    hub.close();
    service.close();
});

function assertion(path: string, claims: object = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', typ: 'calm-ext+jwt', kid: 'k1' };
    const payload = { iss: ISSUER, sub: 'alice', aud: 'ea-layers', iat: now, exp: now + 60, jti: randomUUID(), htm: 'GET', htp: path, ns: 'finos', ...claims };
    const input = [header, payload].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    return `${input}.${sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

const get = (path: string, token = assertion(path)) =>
    fetch(`${base}${path}`, { headers: { 'X-Calm-Hub-Identity': token } });

describe('the layers service', () => {
    const lens = '/lens/finos/architectures/7?version=1.0.0&view=application';

    it('answers a lens request from CALM Hub with a graph, and reads Hub with its own service account', async () => {
        const res = await get(lens);
        expect(res.status).toBe(200);
        const reply = (await res.json()) as { graph: { nodes: { id: string }[] } };
        expect(reply).toMatchObject({ hubApi: 0, kind: 'graph', title: 'Application cooperation view' });
        expect(reply.graph.nodes.map((node) => node.id)).toContain('api');
        expect(hubAuthorizations).toEqual(['Bearer service-token']);
    });

    it('refuses a request without a valid assertion, or for another path', async () => {
        expect((await fetch(`${base}${lens}`)).status).toBe(401);
        expect((await get(lens, assertion('/lens/finos/architectures/8?version=1.0.0'))).status).toBe(401);
        expect((await get(lens, assertion(lens, { aud: 'c4' }))).status).toBe(401);
    });

    it('refuses an assertion for another namespace than the one in the path', async () => {
        const res = await get(lens, assertion(lens, { ns: 'other' }));
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toBe('application/problem+json');
    });

    it('answers with a problem that the lens shows', async () => {
        const missing = '/lens/finos/architectures/7?version=2.0.0';
        expect(await (await get(missing)).json()).toEqual({ type: 'about:blank', title: 'CALM Hub has no such architecture', status: 404, detail: 'finos/7 version 2.0.0' });
        expect(((await (await get('/lens/finos/patterns/7?version=1.0.0')).json()) as { title: string }).title).toBe('The layers lens shows architectures only');
        expect((await get('/lens/finos/architectures/7')).status).toBe(400);
    });

    it('answers its health check with no assertion', async () => {
        expect((await fetch(`${base}/healthz`)).status).toBe(200);
    });
});

describe('architecturePath', () => {
    it('reads a Hub id from the API, and a custom id from the mapping API', () => {
        expect(architecturePath('finos', '7', '1.0.0')).toBe('/api/calm/namespaces/finos/architectures/7/versions/1.0.0');
        expect(architecturePath('finos', 'shop/web', '1.0.0')).toBe('/calm/namespaces/finos/architectures/shop%2Fweb/versions/1.0.0');
    });
});

describe('exportExtension', () => {
    it('copies the manifest and the notation into a folder named after the extension id', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'ea-layers-export-'));
        try {
            const target = await exportExtension(dir);
            expect(target).toBe(join(dir, 'ea-layers'));
            expect(JSON.parse(await readFile(join(target, 'extension.json'), 'utf8')).contributes['diagram-lens'][0].notation).toBe('notation.json');
            expect(Object.keys(JSON.parse(await readFile(join(target, 'notation.json'), 'utf8')).shapes)).toContain('BusinessActor');
        } finally {
            await rm(dir, { recursive: true });
        }
    });
});
