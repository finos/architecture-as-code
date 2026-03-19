import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';

const ax = axios.create({});
const mock = new AxiosMockAdapter(ax);

mock.onGet('https://calm.finos.org/calm/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('direct-url-document-loader', () => {
    let directUrlDocumentLoader;
    beforeEach(() => {
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
        expect(lastRequest.url).toBe(url);
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

    it.each([
        'http://localhost/secret',
        'http://localhost./secret',
        'http://127.0.0.1/secret',
        'http://10.0.0.1/secret',
        'http://172.16.0.1/secret',
        'http://192.168.1.1/secret',
        'http://169.254.169.254/latest/meta-data/',
        'http://0.0.0.0/secret',
        'http://[::1]/secret',
        'http://[0:0:0:0:0:0:0:1]/secret',
        'http://[::ffff:127.0.0.1]/secret',
        'http://[::ffff:10.0.0.1]/secret',
        'http://[::127.0.0.1]/secret',
        'http://[::ffff:0:127.0.0.1]/secret',
        'http://[fe80::1]/secret',
        'http://[fe91::1]/secret',
        'http://[febf::1]/secret',
        'http://[fc00::1]/secret',
        'http://[fd12::1]/secret',
    ])('rejects private/internal network URL: %s', async (url) => {
        await expect(directUrlDocumentLoader.loadMissingDocument(url, 'schema'))
            .rejects.toThrow('private or internal network');
    });
});