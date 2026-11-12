// Run with: node --test calm-hub/local-dev/extensions/example-services/identity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createVerifier } from './identity.mjs';

const NOW = 1_800_000_000;
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwks = {
    keys: [
        { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa', alg: 'RS256', use: 'sig' },
        { ...ec.publicKey.export({ format: 'jwk' }), kid: 'ec', alg: 'ES256', use: 'sig' },
    ],
};
const request = { method: 'GET', pathAndQuery: '/namespaces/finos/services?a=1' };

function token({ header = {}, claims = {}, key = rsa.privateKey } = {}) {
    const h = { alg: 'RS256', typ: 'calm-ext+jwt', kid: 'rsa', ...header };
    const c = { iss: 'http://hub', sub: 'alice', aud: 'example-services', iat: NOW, exp: NOW + 60, jti: String(Math.random()),
        auth: 'oidc', hubApi: 0, route: 'services', scope: 'read', ns: 'finos', htm: 'GET',
        htp: '/namespaces/finos/services?a=1', ...claims };
    const input = `${Buffer.from(JSON.stringify(h)).toString('base64url')}.${Buffer.from(JSON.stringify(c)).toString('base64url')}`;
    const options = h.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key;
    return `${input}.${sign('sha256', Buffer.from(input), options).toString('base64url')}`;
}

function verifier() {
    return createVerifier({ issuer: 'http://hub', audience: 'example-services', fetchJwks: async () => jwks, now: () => NOW });
}

test('accepts an RS256 and an ES256 assertion bound to the request', async () => {
    const verify = verifier();
    assert.equal((await verify(token(), request)).sub, 'alice');
    assert.equal((await verify(token({ header: { alg: 'ES256', kid: 'ec' }, key: ec.privateKey }), request)).ns, 'finos');
});

test('rejects a forged, misdirected, stale or replayed assertion', async () => {
    const verify = verifier();
    const cases = [
        ['not a JWT', 'abc'],
        ['wrong typ', token({ header: { typ: 'JWT' } })],
        ['alg none is not allowed', token({ header: { alg: 'none' } })],
        ['alg HS256 is not allowed', token({ header: { alg: 'HS256' } })],
        ['unknown key id', token({ header: { kid: 'other' } })],
        ['alg does not match the key', token({ header: { alg: 'ES256' } , key: ec.privateKey })],
        ['bad signature', token({ key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey })],
        ['wrong issuer', token({ claims: { iss: 'http://other-hub' } })],
        ['wrong audience', token({ claims: { aud: 'team-services' } })],
        ['expired', token({ claims: { exp: NOW - 31 } })],
        ['issued in the future', token({ claims: { iat: NOW + 31 } })],
        ['wrong method', token({ claims: { htm: 'POST' } })],
        ['wrong path', token({ claims: { htp: '/namespaces/other/services?a=1' } })],
    ];
    for (const [message, value] of cases) {
        await assert.rejects(verify(value, request), { message }, message);
    }
    const once = token({ claims: { jti: 'same' } });
    await verify(once, request);
    await assert.rejects(verify(once, request), { message: 'replayed' });
});

test('binds a request body with bdh', async () => {
    const verify = verifier();
    const body = Buffer.from('{"name":"refunds"}');
    const bdh = createHash('sha256').update(body).digest('base64url');
    const post = { method: 'POST', pathAndQuery: '/namespaces/finos/services', body };
    const claims = { htm: 'POST', htp: '/namespaces/finos/services', bdh };

    assert.equal((await verify(token({ claims }), post)).bdh, bdh);
    await assert.rejects(verify(token({ claims }), { ...post, body: Buffer.from('{"name":"other"}') }), { message: 'wrong body' });
    await assert.rejects(verify(token({ claims: { ...claims, bdh: undefined } }), post), { message: 'wrong body' });
    await assert.rejects(verify(token({ claims: { bdh } }), { ...request, body: Buffer.alloc(0) }), { message: 'wrong body' });
});
