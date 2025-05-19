import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubDocumentLoader } from './calmhub-document-loader';

const calmHubBaseUrl = 'http://local-calmhub';

const ax = axios.create({ baseURL: calmHubBaseUrl });
const mock = new AxiosMockAdapter(ax);

mock.onGet('/calm/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('calmhub-document-loader', () => {
    let calmHubDocumentLoader;
    beforeEach(() => {
        calmHubDocumentLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, ax);
    });

    it('loads a document from CalmHub', async () => {
        const calmHubUrl = 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json';
        const document = await calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema');
        expect(document).toEqual({
            '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'value': 'test'
        });
    });

    it('throws an error when the document is not found', async () => {
        const calmHubUrl = 'https://calm.finos.org/calm/schemas/2025-03/meta/nonexistent.json';

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
    });
});