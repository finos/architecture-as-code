// Verifies the identity assertion that CALM Hub sends in X-Calm-Hub-Identity (ADR 0010).
// It needs only the public JWKS at GET /api/calm/auth/jwks, and no CALM Hub credentials.
import { createHash, createPublicKey, verify } from 'node:crypto';

const ALGORITHMS = { RS256: { hash: 'sha256' }, ES256: { hash: 'sha256', dsaEncoding: 'ieee-p1363' } };
const CLOCK_SKEW_SECONDS = 30;

function decode(part) {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * Returns a function that verifies one assertion and returns its claims, or throws.
 * fetchJwks() returns the JWKS; it is called again when a token names an unknown key id.
 * pathAndQuery is relative to the backend URL that the operator set in CALM Hub. body is the raw request body.
 */
export function createVerifier({ issuer, audience, fetchJwks, now = () => Date.now() / 1000 }) {
    let keys = new Map();
    const seen = new Map();

    async function loadKeys() {
        const { keys: jwks } = await fetchJwks();
        keys = new Map(jwks.map((jwk) => [jwk.kid, { alg: jwk.alg, key: createPublicKey({ key: jwk, format: 'jwk' }) }]));
    }

    return async function verifyAssertion(token, { method, pathAndQuery, body }) {
        const parts = token?.split('.');
        if (parts?.length !== 3) throw new Error('not a JWT');
        const [h, p, s] = parts;
        const header = decode(h);
        if (header.typ !== 'calm-ext+jwt') throw new Error('wrong typ');
        if (!ALGORITHMS[header.alg]) throw new Error(`alg ${header.alg} is not allowed`);
        if (!keys.has(header.kid)) await loadKeys();
        const entry = keys.get(header.kid);
        if (!entry) throw new Error('unknown key id');
        if (entry.alg !== header.alg) throw new Error('alg does not match the key');
        const options = { key: entry.key, ...ALGORITHMS[header.alg] };
        if (!verify(ALGORITHMS[header.alg].hash, Buffer.from(`${h}.${p}`), options, Buffer.from(s, 'base64url'))) {
            throw new Error('bad signature');
        }
        const claims = decode(p);
        const time = Math.floor(now());
        if (claims.iss !== issuer) throw new Error('wrong issuer');
        if (claims.aud !== audience) throw new Error('wrong audience');
        if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < time) throw new Error('expired');
        if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_SECONDS > time) throw new Error('issued in the future');
        // The assertion is bound to this request, so it cannot be replayed against another route.
        if (claims.htm !== method) throw new Error('wrong method');
        if (claims.htp !== pathAndQuery) throw new Error('wrong path');
        // CALM Hub sends bdh only for a request with a body.
        const bodyHash = body?.length ? createHash('sha256').update(body).digest('base64url') : undefined;
        if (claims.bdh !== bodyHash) throw new Error('wrong body');
        if (seen.has(claims.jti)) throw new Error('replayed');
        seen.set(claims.jti, claims.exp);
        for (const [jti, exp] of seen) if (exp + CLOCK_SKEW_SECONDS < time) seen.delete(jti);
        return claims;
    };
}
