// Verifies the identity assertion that CALM Hub sends in X-Calm-Hub-Identity (ADR 0010), with the JWKS only.
// The same checks as calm-hub/local-dev/extensions/example-services/identity.mjs.
import { createHash, createPublicKey, verify, type KeyObject, type webcrypto } from 'node:crypto';

export type Jwks = { keys: (webcrypto.JsonWebKey & { kid: string; alg: string })[] };

const ALGORITHMS: Record<string, { hash: string; dsaEncoding?: 'ieee-p1363' }> = {
    RS256: { hash: 'sha256' },
    ES256: { hash: 'sha256', dsaEncoding: 'ieee-p1363' },
};
const CLOCK_SKEW_SECONDS = 30;
/** An unknown kid can come from anyone, so the service fetches the JWKS again at most this often. */
const REFETCH_SECONDS = 60;
/** The keys are fetched again when they are older than this, so a key that CALM Hub removed stops working. */
const KEY_MAX_AGE_SECONDS = 300;

export interface Claims {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    jti: string;
    htm: string;
    htp: string;
    bdh?: string;
    /** The namespace whose scope Hub checked for a read, write or admin route. */
    ns?: string;
}

export interface VerifierOptions {
    issuer: string;
    audience: string;
    fetchJwks: () => Promise<Jwks>;
    now?: () => number;
}

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/** Returns a function that verifies one assertion for one request and returns its claims, or throws. */
export function createVerifier({ issuer, audience, fetchJwks, now = () => Date.now() / 1000 }: VerifierOptions) {
    let keys = new Map<string, { alg: string; key: KeyObject }>();
    const seen = new Map<string, number>();
    let fetchedAt = -Infinity;
    let loadedAt = -Infinity;
    let loading: Promise<void> | undefined;

    function loadKeys(): Promise<void> {
        if (loading) return loading;
        if (now() - fetchedAt < REFETCH_SECONDS) return Promise.resolve();
        const started = now();
        fetchedAt = started;
        loading = fetchJwks()
            .then(({ keys: jwks }) => {
                keys = new Map(jwks.map((jwk) => [jwk.kid, { alg: jwk.alg, key: createPublicKey({ key: jwk, format: 'jwk' }) }]));
                loadedAt = started;
            })
            .catch((error: unknown) => {
                // Keys that cannot be checked again, or a JWKS that cannot be read, are not trusted any longer.
                keys = new Map();
                throw error;
            })
            .finally(() => {
                loading = undefined;
            });
        return loading;
    }

    return async function verifyAssertion(token: string | undefined, request: { method: string; pathAndQuery: string; body?: Buffer }): Promise<Claims> {
        const parts = token?.split('.');
        if (parts?.length !== 3) throw new Error('not a JWT');
        const [h, p, s] = parts;
        const header = decode(h);
        if (header.typ !== 'calm-ext+jwt') throw new Error('wrong typ');
        const algorithm = ALGORITHMS[header.alg];
        if (!algorithm) throw new Error(`alg ${header.alg} is not allowed`);
        if (!keys.has(header.kid) || now() - loadedAt >= KEY_MAX_AGE_SECONDS) await loadKeys();
        const entry = keys.get(header.kid);
        if (!entry) throw new Error('unknown key id');
        if (entry.alg !== header.alg) throw new Error('alg does not match the key');
        const key = algorithm.dsaEncoding ? { key: entry.key, dsaEncoding: algorithm.dsaEncoding } : entry.key;
        if (!verify(algorithm.hash, Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'))) throw new Error('bad signature');
        const claims = decode(p) as Claims;
        const time = Math.floor(now());
        if (claims.iss !== issuer) throw new Error('wrong issuer');
        if (claims.aud !== audience) throw new Error('wrong audience');
        if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < time) throw new Error('expired');
        if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_SECONDS > time) throw new Error('issued in the future');
        // The assertion is bound to this request, so it cannot be replayed against another route.
        if (claims.htm !== request.method) throw new Error('wrong method');
        if (claims.htp !== request.pathAndQuery) throw new Error('wrong path');
        const bodyHash = request.body?.length ? createHash('sha256').update(request.body).digest('base64url') : undefined;
        if (claims.bdh !== bodyHash) throw new Error('wrong body');
        if (seen.has(claims.jti)) throw new Error('replayed');
        seen.set(claims.jti, claims.exp);
        for (const [jti, exp] of seen) if (exp + CLOCK_SKEW_SECONDS < time) seen.delete(jti);
        return claims;
    };
}

/** A CALM Hub that the service trusts: its issuer, and its public keys or the URL of its JWKS. */
export interface Tenant {
    issuer: string;
    jwks?: Jwks;
    jwksUrl?: string;
}

/** Reads a list of tenants, such as the file that CALM_HUB_TENANTS_FILE names. */
export function parseTenants(text: string): Tenant[] {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value) || value.length === 0) throw new Error('the tenants must be a JSON array with at least one entry');
    return value.map((entry, index) => {
        const { issuer, jwks, jwksUrl } = (entry ?? {}) as Tenant;
        if (typeof issuer !== 'string' || !URL.canParse(issuer)) throw new Error(`tenant ${index} needs an issuer URL`);
        if (!jwks === !jwksUrl) throw new Error(`tenant ${index} needs jwks or jwksUrl, not both`);
        if (jwks && !Array.isArray(jwks.keys)) throw new Error(`tenant ${index} jwks needs keys`);
        if (jwksUrl && !URL.canParse(jwksUrl)) throw new Error(`tenant ${index} jwksUrl is not a URL`);
        return { issuer, ...(jwks ? { jwks } : { jwksUrl }) };
    });
}

/**
 * Verifies assertions from any of the tenants. The service picks the keys by the issuer, and fetches only the JWKS URLs
 * that the operator configured, so a request cannot make it call another host. A tenant with inline keys needs no
 * route from the service to its Hub.
 */
export function createTenantVerifier(tenants: Tenant[], audience: string, now?: () => number) {
    const verifiers = new Map(tenants.map((tenant) => [tenant.issuer, createVerifier({
        issuer: tenant.issuer,
        audience,
        now,
        fetchJwks: async () => {
            if (tenant.jwks) return tenant.jwks;
            const res = await fetch(tenant.jwksUrl!, { signal: AbortSignal.timeout(5_000), redirect: 'error' });
            if (!res.ok) throw new Error(`JWKS request failed with ${res.status}`);
            return (await res.json()) as Jwks;
        },
    })]));
    return async function verifyAssertion(token: string | undefined, request: { method: string; pathAndQuery: string; body?: Buffer }) {
        let issuer: unknown;
        try {
            issuer = decode(token?.split('.')[1] ?? '').iss;
        } catch {
            throw new Error('not a JWT');
        }
        const verifier = typeof issuer === 'string' ? verifiers.get(issuer) : undefined;
        if (typeof verifier !== 'function') throw new Error('unknown issuer');
        return verifier(token, request);
    };
}
