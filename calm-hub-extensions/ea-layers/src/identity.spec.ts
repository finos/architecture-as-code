import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createVerifier, type Jwks } from './identity.js';

const NOW = 1_800_000_000;
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwks = {
    keys: [
        { ...rsa.publicKey.export({ format: 'jwk' }), kid: 'rsa', alg: 'RS256' },
        { ...ec.publicKey.export({ format: 'jwk' }), kid: 'ec', alg: 'ES256' },
    ],
} as Jwks;
const request = { method: 'GET', pathAndQuery: '/lens/finos/architectures/7?version=1.0.0' };

function token({ header = {}, claims = {}, key = rsa.privateKey }: { header?: object; claims?: object; key?: KeyObject } = {}) {
    const h = { alg: 'RS256', typ: 'calm-ext+jwt', kid: 'rsa', ...header };
    const c = { iss: 'http://hub', sub: 'alice', aud: 'ea-layers', iat: NOW, exp: NOW + 60, jti: String(Math.random()), ns: 'finos',
        htm: 'GET', htp: request.pathAndQuery, ...claims };
    const input = [h, c].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    return `${input}.${sign('sha256', Buffer.from(input), h.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key).toString('base64url')}`;
}

const verifier = () => createVerifier({ issuer: 'http://hub', audience: 'ea-layers', fetchJwks: async () => jwks, now: () => NOW });

describe('createVerifier', () => {
    it('accepts an RS256 and an ES256 assertion bound to the request', async () => {
        const verify = verifier();
        expect((await verify(token(), request)).sub).toBe('alice');
        expect((await verify(token({ header: { alg: 'ES256', kid: 'ec' }, key: ec.privateKey }), request)).ns).toBe('finos');
    });

    it.each([
        ['not a JWT', () => 'abc'],
        ['wrong typ', () => token({ header: { typ: 'JWT' } })],
        ['alg HS256 is not allowed', () => token({ header: { alg: 'HS256' } })],
        ['unknown key id', () => token({ header: { kid: 'other' } })],
        ['alg does not match the key', () => token({ header: { alg: 'ES256' }, key: ec.privateKey })],
        ['bad signature', () => token({ key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey })],
        ['wrong issuer', () => token({ claims: { iss: 'http://other-hub' } })],
        ['wrong audience', () => token({ claims: { aud: 'release-tracker' } })],
        ['expired', () => token({ claims: { exp: NOW - 31 } })],
        ['issued in the future', () => token({ claims: { iat: NOW + 31 } })],
        ['wrong method', () => token({ claims: { htm: 'POST' } })],
        ['wrong path', () => token({ claims: { htp: '/lens/finos/architectures/8?version=1.0.0' } })],
    ])('rejects an assertion: %s', async (message, make) => {
        await expect(verifier()(make(), request)).rejects.toThrow(message);
    });

    it('rejects a replayed assertion, and one with a body hash for a request with no body', async () => {
        const verify = verifier();
        const once = token({ claims: { jti: 'same' } });
        await verify(once, request);
        await expect(verify(once, request)).rejects.toThrow('replayed');
        const bdh = createHash('sha256').update('{}').digest('base64url');
        await expect(verify(token({ claims: { bdh } }), request)).rejects.toThrow('wrong body');
    });
});
