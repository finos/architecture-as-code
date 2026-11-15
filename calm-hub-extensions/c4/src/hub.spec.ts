import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubClient } from './hub.js';

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('HubClient', () => {
    it('calls a no-auth Hub with no token, and treats 204 and 404 as nothing', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(json(204)).mockResolvedValueOnce(json(404, {}));
        vi.stubGlobal('fetch', fetch);
        const hub = new HubClient('http://calmhub:8080');
        expect(await hub.get('/api/a')).toBeUndefined();
        expect(await hub.get('/api/b')).toBeUndefined();
        expect(fetch.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' });
    });

    it('keeps a client credentials token until a minute before it expires', async () => {
        let now = 0;
        const fetch = vi.fn(async (url: URL | string) => (String(url).endsWith('/token') ? json(200, { access_token: `t${now}`, expires_in: 120 }) : json(200, {})));
        vi.stubGlobal('fetch', fetch);
        const hub = new HubClient('http://calmhub:8080', { tokenUrl: 'http://idp/token', clientId: 'c4', clientSecret: 's:1' }, () => now);
        await hub.get('/api/a');
        now = 59_000;
        await hub.get('/api/b');
        now = 61_000;
        await hub.get('/api/c');
        const calls = fetch.mock.calls as unknown as [URL | string, RequestInit][];
        const authorizations = calls.filter(([url]) => !String(url).endsWith('/token')).map(([, init]) => (init.headers as Record<string, string>).Authorization);
        expect(authorizations).toEqual(['Bearer t0', 'Bearer t0', 'Bearer t61000']);
        const [, tokenRequest] = calls[0];
        expect((tokenRequest.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('c4:s%3A1').toString('base64')}`);
        expect(String(tokenRequest.body)).toBe('grant_type=client_credentials');
    });

    it('fails with a problem when Hub or the token endpoint fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500, {})));
        await expect(new HubClient('http://calmhub:8080').get('/api/a')).rejects.toMatchObject({ status: 502, title: 'CALM Hub did not answer the C4 service' });
        await expect(new HubClient('http://calmhub:8080', { tokenUrl: 'http://idp/token' }).get('/api/a'))
            .rejects.toMatchObject({ status: 502, title: 'The C4 service cannot sign in to CALM Hub' });
    });
});
