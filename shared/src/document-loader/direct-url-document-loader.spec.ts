import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';
import { DocumentLoadError } from './document-loader';

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

    it('rejects non-allowlisted public hosts', async () => {
        const url = 'https://example.com/public-schema.json';
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('is not allowlisted');
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

    it('throws DocumentLoadError for disallowed host', async () => {
        await expect(directUrlDocumentLoader.loadMissingDocument('https://finos.org/doc.json', 'schema'))
            .rejects.toBeInstanceOf(DocumentLoadError);
    });

    it('rejects URLs that include credentials', async () => {
        await expect(directUrlDocumentLoader.loadMissingDocument('https://user:secret@calm.finos.org/core.json', 'schema'))
            .rejects.toThrow('Credentials in URL are not allowed');
    });
});
