import { createHash, generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Jwks } from './identity.js';
import { createC4Server, exportExtension } from './server.js';
import { SHOP } from './testing.js';

// Two Hubs: a sidecar Hub that the service reads keys from, and a Hub registered with its keys, as a hosted service has.
const SIDECAR = 'http://hub.test';
const REGISTERED = 'https://hub.bank.example';
const sidecarKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const registeredKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwksOf = (key: KeyObject, kid: string): Jwks => ({ keys: [{ ...key.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' }] });

let hub: Server;
let service: Server;
let base: string;
const hubRequests: string[] = [];

async function listen(server: Server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
    hub = createServer((req, res) => {
        hubRequests.push(req.url ?? '');
        if (req.url === '/api/calm/auth/jwks') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(jwksOf(sidecarKeys.publicKey, 's1')));
        return res.writeHead(404).end();
    });
    const hubUrl = await listen(hub);
    service = createC4Server({ tenants: [
        { issuer: SIDECAR, jwksUrl: `${hubUrl}/api/calm/auth/jwks` },
        { issuer: REGISTERED, jwks: jwksOf(registeredKeys.publicKey, 'r1') },
    ] });
    base = await listen(service);
});

afterAll(() => {
    hub.close();
    service.close();
});

const BODY = JSON.stringify({ hubApi: 0, document: SHOP });
const bdh = (body: string) => (body ? createHash('sha256').update(body).digest('base64url') : undefined);

function assertion(path: string, body = BODY, claims: Record<string, unknown> = {}) {
    const issuer = (claims.iss as string | undefined) ?? SIDECAR;
    const [key, kid] = issuer === REGISTERED ? [registeredKeys.privateKey, 'r1'] : [sidecarKeys.privateKey, 's1'];
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', typ: 'calm-ext+jwt', kid };
    const payload = { iss: issuer, sub: 'alice', aud: 'c4', iat: now, exp: now + 60, jti: randomUUID(), htm: 'POST', htp: path, bdh: bdh(body), ns: 'finos', ...claims };
    const input = [header, payload].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    return `${input}.${sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

const post = (path: string, body = BODY, token = assertion(path, body)) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'X-Calm-Hub-Identity': token, 'Content-Type': 'application/json' }, body });

describe('the C4 service', () => {
    const lens = '/lens/finos/architectures/7?version=1.0.0&level=container&scope=shop';

    it('draws the architecture that Hub sent, and calls Hub only for its keys', async () => {
        const res = await post(lens);
        expect(res.status).toBe(200);
        const reply = (await res.json()) as { graph: { nodes: { id: string }[] } };
        expect(reply).toMatchObject({ hubApi: 0, kind: 'graph', title: 'Container diagram: shop' });
        expect(reply.graph.nodes.map((node) => node.id)).toContain('db');
        expect(hubRequests.every((url) => url === '/api/calm/auth/jwks')).toBe(true);
    });

    it('answers a registered Hub with the keys that it registered, with no request to that Hub', async () => {
        const before = hubRequests.length;
        const res = await post(lens, BODY, assertion(lens, BODY, { iss: REGISTERED }));
        expect(res.status).toBe(200);
        expect(hubRequests.length).toBe(before);
    });

    it('refuses a Hub that is not registered, a body that Hub did not sign, or another path', async () => {
        expect((await post(lens, BODY, assertion(lens, BODY, { iss: 'https://evil.example' }))).status).toBe(401);
        expect((await post(lens, JSON.stringify({ document: { nodes: [] } }), assertion(lens))).status).toBe(401);
        expect((await post(lens, BODY, assertion('/lens/finos/architectures/8?version=1.0.0'))).status).toBe(401);
        expect((await post(lens, BODY, assertion(lens, BODY, { aud: 'ea-layers' }))).status).toBe(401);
        expect((await fetch(`${base}${lens}`, { method: 'POST', body: BODY })).status).toBe(401);
    });

    it('refuses an assertion for another namespace than the one in the path', async () => {
        const res = await post(lens, BODY, assertion(lens, BODY, { ns: 'other' }));
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toBe('application/problem+json');
    });

    it('answers a request target that is not a URL with 400, and keeps running', async () => {
        const { request } = await import('node:http');
        const status = await new Promise<number | undefined>((resolve, reject) => {
            const { hostname, port } = new URL(base);
            request({ hostname, port, path: '//[', method: 'GET' }, (res) => { res.resume(); resolve(res.statusCode); })
                .on('error', reject).end();
        });
        expect(status).toBe(400);
        expect((await fetch(`${base}/healthz`)).status).toBe(200);
    });

    it('refuses a path with an escape that is not valid', async () => {
        const bad = '/lens/finos/architectures/%E0?version=1.0.0';
        expect((await post(bad, BODY, assertion(bad))).status).toBe(400);
    });

    it('answers with a problem that the lens shows', async () => {
        const patterns = '/lens/finos/patterns/7?version=1.0.0';
        expect(((await (await post(patterns)).json()) as { title: string }).title).toBe('The C4 lens shows architectures only');
        expect(await (await post(lens, '{}')).json()).toMatchObject({ status: 400, title: 'CALM Hub sent no architecture' });
        for (const nodes of [[null], ['api'], [{ 'unique-id': 'api' }]]) {
            expect(await (await post(lens, JSON.stringify({ document: { nodes } }))).json()).toMatchObject({ status: 400, title: 'The architecture is not valid CALM' });
        }
        for (const type of [{ connects: {} }, { interacts: { actor: 'a' } }, { 'composed-of': { container: 'a', nodes: [1] } }]) {
            const document = { nodes: [], relationships: [{ 'unique-id': 'r', 'relationship-type': type }] };
            expect(await (await post(lens, JSON.stringify({ document }))).json()).toMatchObject({ status: 400, title: 'The architecture is not valid CALM' });
        }
    });

    it('serves its health check and its extension files with no assertion', async () => {
        expect((await fetch(`${base}/healthz`)).status).toBe(200);
        const manifest = (await (await fetch(`${base}/extension/extension.json`)).json()) as { id: string };
        expect(manifest.id).toBe('c4');
        expect((await fetch(`${base}/extension/notation.json`)).status).toBe(200);
        expect((await fetch(`${base}/extension/package.json`)).status).toBe(401);
    });
});

describe('an open service', () => {
    let open: Server;
    let openBase: string;
    const lens = '/lens/finos/architectures/7?version=1.0.0&level=container&scope=shop';

    beforeAll(async () => {
        open = createC4Server({ tenants: 'open' });
        openBase = await listen(open);
    });

    afterAll(() => {
        open.close();
    });

    const openPost = (body: string, headers: Record<string, string> = {}) =>
        fetch(`${openBase}${lens}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

    it('draws the body for any caller, with or without an assertion', async () => {
        const plain = await openPost(BODY);
        expect(plain.status).toBe(200);
        expect(await plain.json()).toMatchObject({ kind: 'graph', title: 'Container diagram: shop' });
        const unknownHub = await openPost(BODY, { 'X-Calm-Hub-Identity': assertion(lens, BODY, { iss: 'https://any-hub.example', ns: 'other' }) });
        expect(unknownHub.status).toBe(200);
    });

    it('still refuses a body with no architecture, and any other route', async () => {
        expect((await openPost('{}')).status).toBe(400);
        expect((await openPost('not json')).status).toBe(400);
        expect((await fetch(`${openBase}${lens}`)).status).toBe(404);
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
