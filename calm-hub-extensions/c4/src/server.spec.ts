import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createC4Server, exportExtension } from './server.js';
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
        if (req.url === '/api/calm/namespaces/finos/conventions/c4-mapping/default') return json(204);
        return json(404, {});
    });
    const hubUrl = await listen(hub);
    service = createC4Server({ hubUrl, issuer: ISSUER, account: { tokenUrl: `${hubUrl}/token`, clientId: 'c4', clientSecret: 'secret' } });
    base = await listen(service);
});

afterAll(() => {
    hub.close();
    service.close();
});

function assertion(path: string, claims: object = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', typ: 'calm-ext+jwt', kid: 'k1' };
    const payload = { iss: ISSUER, sub: 'alice', aud: 'c4', iat: now, exp: now + 60, jti: randomUUID(), htm: 'GET', htp: path, ns: 'finos', ...claims };
    const input = [header, payload].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    return `${input}.${sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

const get = (path: string, token = assertion(path)) =>
    fetch(`${base}${path}`, { headers: { 'X-Calm-Hub-Identity': token } });

describe('the C4 service', () => {
    const lens = '/lens/finos/architectures/7?version=1.0.0&level=container&scope=shop';

    it('answers a lens request from CALM Hub with a graph, and reads Hub with its own service account', async () => {
        const res = await get(lens);
        expect(res.status).toBe(200);
        const reply = (await res.json()) as { graph: { nodes: { id: string }[] } };
        expect(reply).toMatchObject({ hubApi: 0, kind: 'graph', title: 'Container diagram: shop' });
        expect(reply.graph.nodes.map((node) => node.id)).toContain('db');
        expect(hubAuthorizations).toEqual(['Bearer service-token', 'Bearer service-token']);
    });

    it('refuses a request without a valid assertion, or for another path', async () => {
        expect((await fetch(`${base}${lens}`)).status).toBe(401);
        expect((await get(lens, assertion('/lens/finos/architectures/8?version=1.0.0'))).status).toBe(401);
        expect((await get(lens, assertion(lens, { aud: 'release-tracker' }))).status).toBe(401);
    });

    it('refuses an assertion for another namespace than the one in the path', async () => {
        const res = await get(lens, assertion(lens, { ns: 'other' }));
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toBe('application/problem+json');
    });

    it('answers with a problem that the lens shows', async () => {
        const missing = '/lens/finos/architectures/7?version=2.0.0';
        expect(await (await get(missing)).json()).toEqual({ type: 'about:blank', title: 'CALM Hub has no such architecture', status: 404, detail: 'finos/7 version 2.0.0' });
        expect(((await (await get('/lens/finos/patterns/7?version=1.0.0')).json()) as { title: string }).title).toBe('The C4 lens shows architectures only');
        expect((await get('/lens/finos/architectures/7')).status).toBe(400);
    });

    it('answers its health check with no assertion', async () => {
        expect((await fetch(`${base}/healthz`)).status).toBe(200);
    });
});

describe('exportExtension', () => {
    it('copies the manifest and the notation into a folder named after the extension id', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'c4-export-'));
        try {
            const target = await exportExtension(dir);
            expect(target).toBe(join(dir, 'c4'));
            expect(JSON.parse(await readFile(join(target, 'extension.json'), 'utf8')).contributes['diagram-lens'][0].notation).toBe('notation.json');
            expect(Object.keys(JSON.parse(await readFile(join(target, 'notation.json'), 'utf8')).shapes)).toContain('Person');
        } finally {
            await rm(dir, { recursive: true });
        }
    });
});
