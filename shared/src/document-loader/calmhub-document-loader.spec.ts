import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { SchemaDirectory } from '../schema-directory';

const calmHubBaseUrl = 'http://local-calmhub';

const ax = axios.create({ baseURL: calmHubBaseUrl });
const mock = new AxiosMockAdapter(ax);

mock.onGet('/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('calmhub-document-loader', () => {
    let calmHubDocumentLoader: CalmHubDocumentLoader;
    let schemaDirectory: SchemaDirectory;
    beforeEach(() => {
        calmHubDocumentLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, ax);
        calmHubDocumentLoader.initialise(schemaDirectory);
    });

    it('loads a document from CalmHub', async () => {
        const calmHubUrl = 'calm:/schemas/2025-03/meta/core.json';
        const document = await calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema');
        expect(document).toEqual({
            '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'value': 'test'
        });
    });

    it('throws an error when the document is not found', async () => {
        const calmHubUrl = 'calm:/schemas/2025-03/meta/nonexistent.json';

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
    });

    it('throws an error when the protocol is not calm:', async () => {
        const calmHubUrl = 'https://not.calmhub.com/schemas/2025-03/meta/nonexistent.json';

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
    });
});