import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';

const ax = axios.create({});
const mock = new AxiosMockAdapter(ax);

mock.onGet('https://calm.finos.org/calm/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('calmhub-document-loader', () => {
    let directUrlDocumentLoader;
    beforeEach(() => {
        directUrlDocumentLoader = new DirectUrlDocumentLoader(ax);
    });

    it('loads a document directly from a URL', async () => {
        const url = 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json';
        const document = await directUrlDocumentLoader.loadMissingDocument(url, 'schema');
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
});