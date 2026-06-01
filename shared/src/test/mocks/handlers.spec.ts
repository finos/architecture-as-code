import { describe, expect, it } from 'vitest';
import { createHandlers } from './handlers';

describe('createHandlers', () => {
    it('returns one handler per config entry', () => {
        const handlers = createHandlers([
            { url: 'https://api.example/string', response: 'hello' },
            { url: 'https://api.example/status', response: 404 },
            { url: 'https://api.example/json', response: { ok: true } },
            { url: 'https://api.example/fixture', response: { fixture: 'markdown.md' } },
        ]);

        expect(handlers).toHaveLength(4);
        // The handlers come from msw's http.get(...) factories; each exposes
        // an `info` with the method/path the handler was registered for.
        for (const h of handlers) {
            expect(h.info.method).toBe('GET');
        }
    });

    it('serves string responses as text', async () => {
        const [handler] = createHandlers([
            { url: 'https://api.example/text', response: 'plain text payload' },
        ]);
        const result = await handler.run({
            request: new Request('https://api.example/text', { method: 'GET' }),
            requestId: '1',
        });
        const response = result?.response as Response;
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('plain text payload');
    });

    it('serves status-code responses with empty bodies', async () => {
        const [handler] = createHandlers([
            { url: 'https://api.example/notfound', response: 418 },
        ]);
        const result = await handler.run({
            request: new Request('https://api.example/notfound', { method: 'GET' }),
            requestId: '2',
        });
        const response = result?.response as Response;
        expect(response.status).toBe(418);
    });

    it('serves JSON object responses as JSON', async () => {
        const payload = { hello: 'world', n: 42 };
        const [handler] = createHandlers([
            { url: 'https://api.example/json', response: payload },
        ]);
        const result = await handler.run({
            request: new Request('https://api.example/json', { method: 'GET' }),
            requestId: '3',
        });
        const response = result?.response as Response;
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(payload);
    });

    it('serves fixture-file responses by reading the file from disk', async () => {
        const [handler] = createHandlers([
            { url: 'https://api.example/fixture', response: { fixture: 'markdown.md' } },
        ]);
        const result = await handler.run({
            request: new Request('https://api.example/fixture', { method: 'GET' }),
            requestId: '4',
        });
        const response = result?.response as Response;
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        // Just verify some content was read; the exact bytes depend on the fixture file.
        const text = await response.text();
        expect(text.length).toBeGreaterThan(0);
    });

    it('throws when the fixture file cannot be read', () => {
        expect(() =>
            createHandlers([
                { url: 'https://api.example/missing', response: { fixture: 'no-such-file.json' } },
            ])
        ).toThrow();
    });
});
