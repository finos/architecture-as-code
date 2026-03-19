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

    it('rejects paths containing directory traversal segments', async () => {
        const traversalUrl = 'calm:/schemas/2025-03/../../admin/secrets.json';
        await expect(calmHubDocumentLoader.loadMissingDocument(traversalUrl, 'schema'))
            .rejects.toThrow('directory traversal');
    });

    it('rejects percent-encoded directory traversal segments', async () => {
        const traversalUrl = 'calm:/schemas/%2e%2e/admin/secrets.json';
        await expect(calmHubDocumentLoader.loadMissingDocument(traversalUrl, 'schema'))
            .rejects.toThrow('directory traversal');
    });

    it('rejects encoded slash traversal (%2f)', async () => {
        const traversalUrl = 'calm:/schemas%2f..%2fadmin/secrets.json';
        await expect(calmHubDocumentLoader.loadMissingDocument(traversalUrl, 'schema'))
            .rejects.toThrow('directory traversal');
    });

    it('rejects double-encoded traversal (%252e)', async () => {
        const traversalUrl = 'calm:/schemas/%252e%252e/admin/secrets.json';
        await expect(calmHubDocumentLoader.loadMissingDocument(traversalUrl, 'schema'))
            .rejects.toThrow('directory traversal');
    });

    it('rejects malformed percent-encoding in path', async () => {
        const malformedUrl = 'calm:/schemas/%ZZ/invalid.json';
        await expect(calmHubDocumentLoader.loadMissingDocument(malformedUrl, 'schema'))
            .rejects.toThrow('invalid percent-encoding');
    });
});