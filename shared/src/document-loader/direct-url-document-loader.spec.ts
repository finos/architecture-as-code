import axios from 'axios';
import * as https from 'node:https';
import AxiosMockAdapter from 'axios-mock-adapter';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';
import { DocumentLoadError } from './document-loader';
import type { Logger } from '../logger';

const ax = axios.create({});
const mock = new AxiosMockAdapter(ax);

mock.onGet('https://calm.finos.org/calm/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});
mock.onGet('/calm/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('direct-url-document-loader', () => {
    let directUrlDocumentLoader: DirectUrlDocumentLoader;
    beforeEach(() => {
        mock.resetHistory();
        directUrlDocumentLoader = new DirectUrlDocumentLoader(false, ax);
    });

    it('loads a document directly from a URL', async () => {
        const url = 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json';
        const document = await directUrlDocumentLoader.loadMissingDocument(url, 'pattern');
        expect(document).toEqual({
            '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'value': 'test'
        });
        // Assert the mock was called with the correct URL
        const lastRequest = mock.history.get[mock.history.get.length - 1];
        expect(lastRequest.url).toBe('/calm/schemas/2025-03/meta/core.json');
        expect(lastRequest.baseURL).toBe('https://calm.finos.org');
    });

    it('throws an error when the document is not found', async () => {
        const url = 'https://calm.finos.org/calm/schemas/2025-03/meta/nonexistent.json';

        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema')).rejects.toThrow();
    });

    it('rejects URLs with non-http/https protocols', async () => {
        const fileUrl = 'file:///etc/passwd';
        await expect(directUrlDocumentLoader.loadMissingDocument(fileUrl, 'schema'))
            .rejects.toThrow('Only HTTP and HTTPS are allowed');
    });

    it('rejects URLs with ftp protocol', async () => {
        const ftpUrl = 'ftp://example.com/document.json';
        await expect(directUrlDocumentLoader.loadMissingDocument(ftpUrl, 'schema'))
            .rejects.toThrow('Only HTTP and HTTPS are allowed');
    });

    it('rejects URLs targeting localhost', async () => {
        const url = 'http://localhost/admin';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting 127.x.x.x', async () => {
        const url = 'http://127.0.0.1/secret';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting 10.x private range', async () => {
        const url = 'https://10.0.0.1/internal';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting 192.168.x private range', async () => {
        const url = 'https://192.168.1.1/admin';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting 172.16-31.x private range', async () => {
        const url = 'https://172.16.0.1/internal';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting link-local addresses', async () => {
        const url = 'http://169.254.169.254/latest/meta-data';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting IPv6 loopback', async () => {
        const url = 'http://[::1]/admin';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting IPv6 private (fc00::)', async () => {
        const url = 'http://[fc00::1]/internal';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects URLs targeting IPv6 link-local (fe80::)', async () => {
        const url = 'http://[fe80::1]/internal';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network addresses are not allowed');
    });

    it('does not block legitimate hostnames starting with IP-like prefixes', async () => {
        const url = 'https://10.example.com/document.json';
        // Should NOT throw "private or internal" - it's a DNS name, not an IP
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.not.toThrow('private or internal network addresses are not allowed');
    });

    it('rejects non-allowlisted public hosts with helpful guidance', async () => {
        const url = 'https://example.com/public-schema.json';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('is not allowlisted');
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('calm init-config --allowed-remote-hosts example.com');
    });

    it('allows loading from configured allowlisted host', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/core.json`;
        mock.onGet('/core.json').reply(200, { '$id': url, 'title': 'schema' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost]);

        const document = await allowlistedLoader.loadMissingDocument(url, 'schema');

        expect(document).toEqual({ '$id': url, 'title': 'schema' });
    });

    it('normalizes hostnames in allowlist checks', async () => {
        const url = 'https://SCHEMAS.EXAMPLE.COM/upper.json';
        mock.onGet('/upper.json').reply(200, { '$id': url });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, ['schemas.example.com']);

        const document = await allowlistedLoader.loadMissingDocument(url, 'schema');

        expect(document).toEqual({ '$id': url });
    });

    it('adds auth headers from the direct URL auth plugin for allowlisted hosts', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/protected.json`;
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn().mockResolvedValue({
                'Authorization': 'Bearer test-token',
                'X-Trace-Id': 'trace-123'
            })
        };
        mock.onGet('/protected.json').reply(200, { '$id': url, 'title': 'schema' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost], directUrlAuthPlugin);

        const document = await allowlistedLoader.loadMissingDocument(url, 'schema');

        expect(document).toEqual({ '$id': url, 'title': 'schema' });
        expect(directUrlAuthPlugin.getAuthHeaders).toHaveBeenCalledWith(url, undefined);
        const lastRequest = mock.history.get[mock.history.get.length - 1];
        expect(lastRequest.headers?.Authorization).toBe('Bearer test-token');
        expect(lastRequest.headers?.['X-Trace-Id']).toBe('trace-123');
    });

    it('uses HTTPS agent settings returned by the direct URL auth plugin', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/tls-protected.json`;
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn().mockResolvedValue({
                'Authorization': 'Bearer test-token',
            }),
            getTlsConfig: vi.fn().mockResolvedValue({
                httpsCaCert: 'test-ca-cert',
            }),
        };
        mock.onGet('/tls-protected.json').reply(200, { '$id': url, 'title': 'schema' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost], directUrlAuthPlugin);

        const document = await allowlistedLoader.loadMissingDocument(url, 'schema');

        expect(document).toEqual({ '$id': url, 'title': 'schema' });
        const lastRequest = mock.history.get[mock.history.get.length - 1];
        expect(lastRequest.httpsAgent).toBeInstanceOf(https.Agent);
        expect((lastRequest.httpsAgent as https.Agent).options.ca).toBe('test-ca-cert');
    });

    it('redacts sensitive auth headers in debug logs while keeping safe request metadata', async () => {
        const loggerModule = await import('../logger');
        const mockLogger: Logger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        vi.spyOn(loggerModule, 'initLogger').mockReturnValue(mockLogger);

        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/debug-protected.json`;
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn().mockResolvedValue({
                'Authorization': 'Bearer super-secret-token',
                'X-Api-Key': 'api-key-secret',
                'X-Trace-Id': 'trace-123'
            })
        };
        mock.onGet('/debug-protected.json').reply(200, { '$id': url, 'title': 'schema' });

        const debugLoader = new DirectUrlDocumentLoader(true, ax, [allowlistedHost], directUrlAuthPlugin);
        await debugLoader.loadMissingDocument(url, 'schema');

        const debugOutput = (mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls
            .map(([message]) => String(message))
            .join('\n');

        expect(debugOutput).toContain('Starting Request:');
        expect(debugOutput).toContain('"method": "get"');
        expect(debugOutput).toContain(`"url": "${url}"`);
        expect(debugOutput).toContain('"authHeadersPresent": true');
        expect(debugOutput).toContain('"authHeaderNames": [');
        expect(debugOutput).toContain('"Authorization"');
        expect(debugOutput).toContain('"X-Api-Key"');
        expect(debugOutput).toContain('"X-Trace-Id"');
        expect(debugOutput).toContain('"headers": {');
        expect(debugOutput).toContain('"Accept": "application/json, text/plain, */*"');
        expect(debugOutput).toContain('Response:');
        expect(debugOutput).toContain('"status": 200');
        expect(debugOutput).not.toContain('super-secret-token');
        expect(debugOutput).not.toContain('api-key-secret');
        expect(debugOutput).not.toContain('trace-123');
    });

    it('never logs values for custom auth header names returned by the plugin', async () => {
        const loggerModule = await import('../logger');
        const mockLogger: Logger = {
            log: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        vi.spyOn(loggerModule, 'initLogger').mockReturnValue(mockLogger);

        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/custom-auth-headers.json`;
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn().mockResolvedValue({
                'Private-Token': 'private-token-secret',
                'X-Client-Secret': 'client-secret-value',
                'Api-Key': 'api-key-value',
                'X-Amz-Security-Token': 'aws-session-token'
            })
        };
        mock.onGet('/custom-auth-headers.json').reply(200, { '$id': url, 'title': 'schema' });

        const debugLoader = new DirectUrlDocumentLoader(true, ax, [allowlistedHost], directUrlAuthPlugin);
        await debugLoader.loadMissingDocument(url, 'schema');

        const debugOutput = (mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls
            .map(([message]) => String(message))
            .join('\n');

        expect(debugOutput).toContain('"Private-Token"');
        expect(debugOutput).toContain('"X-Client-Secret"');
        expect(debugOutput).toContain('"Api-Key"');
        expect(debugOutput).toContain('"X-Amz-Security-Token"');
        expect(debugOutput).not.toContain('private-token-secret');
        expect(debugOutput).not.toContain('client-secret-value');
        expect(debugOutput).not.toContain('api-key-value');
        expect(debugOutput).not.toContain('aws-session-token');
    });

    it('treats direct URL auth plugin runtime failures as fatal', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/protected.json`;
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn().mockRejectedValue(new Error('token exchange failed: super-secret-token'))
        };
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost], directUrlAuthPlugin);

        const promise = allowlistedLoader.loadMissingDocument(url, 'schema');

        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toMatchObject({ recoverable: false });
        await expect(promise).rejects.toMatchObject({ name: 'AUTHENTICATION_FAILED' });
        await expect(promise).rejects.toThrow(`Direct URL authentication failed for ${url}. Check direct URL auth configuration and remote credentials.`);
        await expect(promise).rejects.not.toThrow('super-secret-token');
        expect(mock.history.get).toHaveLength(0);
    });

    it('surfaces explicit auth errors for HTTP 401 responses', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/protected-401.json`;
        mock.onGet('/protected-401.json').reply(401, { message: 'unauthorized' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost]);

        const promise = allowlistedLoader.loadMissingDocument(url, 'schema');

        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toMatchObject({ name: 'AUTHENTICATION_FAILED', recoverable: false });
        await expect(promise).rejects.toThrow(`Direct URL request was not authorized for ${url} (HTTP 401)`);
    });

    it('surfaces explicit auth errors for HTTP 403 responses', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/protected-403.json`;
        mock.onGet('/protected-403.json').reply(403, { message: 'forbidden' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost]);

        const promise = allowlistedLoader.loadMissingDocument(url, 'schema');

        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toMatchObject({ name: 'AUTHENTICATION_FAILED', recoverable: false });
        await expect(promise).rejects.toThrow(`Direct URL request was not authorized for ${url} (HTTP 403)`);
    });

    it('keeps 404 responses on the generic direct URL failure path', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/missing.json`;
        mock.onGet('/missing.json').reply(404, { message: 'not found' });
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost]);

        const promise = allowlistedLoader.loadMissingDocument(url, 'schema');

        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toMatchObject({ name: 'UNKNOWN', recoverable: false });
        await expect(promise).rejects.toThrow(`Failed to load document from URL: ${url}`);
    });

    it('keeps network failures on the generic direct URL failure path', async () => {
        const allowlistedHost = 'schemas.example.com';
        const url = `https://${allowlistedHost}/network-error.json`;
        mock.onGet('/network-error.json').networkError();
        const allowlistedLoader = new DirectUrlDocumentLoader(false, ax, [allowlistedHost]);

        const promise = allowlistedLoader.loadMissingDocument(url, 'schema');

        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toMatchObject({ name: 'UNKNOWN', recoverable: false });
        await expect(promise).rejects.toThrow(`Failed to load document from URL: ${url}`);
    });

    it('throws DocumentLoadError for disallowed host', async () => {
        await expect(directUrlDocumentLoader.loadMissingDocument('https://finos.org/doc.json', 'schema'))
            .rejects.toBeInstanceOf(DocumentLoadError);
    });

    it('rejects URLs that include credentials', async () => {
        await expect(directUrlDocumentLoader.loadMissingDocument('https://user:secret@calm.finos.org/core.json', 'schema'))
            .rejects.toThrow('Credentials in URL are not allowed');
    });

    it('throws when response is a string instead of an object', async () => {
        mock.onGet('/string-response.json').reply(200, 'just a string');
        const promise = directUrlDocumentLoader.loadMissingDocument('https://calm.finos.org/string-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });

    it('throws when response is null', async () => {
        mock.onGet('/null-response.json').reply(200, null);
        const promise = directUrlDocumentLoader.loadMissingDocument('https://calm.finos.org/null-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });

    it('throws when response is an array', async () => {
        mock.onGet('/array-response.json').reply(200, [{ '$id': 'foo' }]);
        const promise = directUrlDocumentLoader.loadMissingDocument('https://calm.finos.org/array-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });

    it('rejects URLs with path traversal sequences', async () => {
        const url = 'https://calm.finos.org/calm/../secret.json';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('directory traversal');
    });

    it('does not call the direct URL auth plugin for unsafe URLs', async () => {
        const directUrlAuthPlugin = {
            getAuthHeaders: vi.fn()
        };
        const loader = new DirectUrlDocumentLoader(false, ax, ['calm.finos.org'], directUrlAuthPlugin);
        const url = 'https://calm.finos.org/core.json;evil';

        await expect(loader.loadMissingDocument(url, 'schema')).rejects.toThrow('disallowed characters');
        expect(directUrlAuthPlugin.getAuthHeaders).not.toHaveBeenCalled();
    });

    it('rejects paths containing disallowed characters', async () => {
        const url = 'https://calm.finos.org/core.json;evil';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('disallowed characters');
    });

    it('rejects URLs that include a query string', async () => {
        const url = 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json?evil=1';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('query string');
    });
});
