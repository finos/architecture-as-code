import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { DocumentLoadError } from './document-loader';
import { SchemaDirectory } from '../schema-directory';
import { AuthPlugin } from '..';

const calmHubBaseUrl = 'http://local-calmhub';

const ax = axios.create({ baseURL: calmHubBaseUrl });
const mock = new AxiosMockAdapter(ax);

mock.onGet('/schemas/2025-03/meta/core.json').reply(200, {
    '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
    'value': 'test'
});

describe('calmhub-document-loader', () => {
    let calmHubDocumentLoader: CalmHubDocumentLoader;
    const schemaDirectory: SchemaDirectory = {} as unknown as SchemaDirectory;
    beforeEach(() => {
        calmHubDocumentLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, undefined, ax);
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
    
    it('fails to load a document with invalid url scheme', async () => {
        const calmHubUrl = 'ftp://schemas/2025-03/meta/core.json';
        await expect(async () => await calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
    });
    
    it('calls configured auth plugin if provided', async () => {
        const authPlugin: AuthPlugin = {
            getAuthHeaders: vi.fn().mockResolvedValue({ 'Authorization': 'Bearer test-token' })
        }; 
        calmHubDocumentLoader = new CalmHubDocumentLoader(calmHubBaseUrl, false, authPlugin, ax);
        const calmHubUrl = 'calm:/schemas/2025-03/meta/core.json';
        const document = await calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema');
        expect(document).toEqual({
            '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'value': 'test'
        });
        expect(authPlugin.getAuthHeaders).toHaveBeenCalledWith('http://local-calmhub/schemas/2025-03/meta/core.json', undefined);
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

    it('rejects paths with disallowed characters', async () => {
        const maliciousUrl = 'calm:/schemas/%00malicious';
        await expect(calmHubDocumentLoader.loadMissingDocument(maliciousUrl, 'schema'))
            .rejects.toThrow('disallowed characters');
    });

    it('throws when response is a string instead of an object', async () => {
        mock.onGet('/schemas/2025-03/meta/string-response.json').reply(200, 'just a string');
        const promise = calmHubDocumentLoader.loadMissingDocument('calm:/schemas/2025-03/meta/string-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });

    it('throws when response is null', async () => {
        mock.onGet('/schemas/2025-03/meta/null-response.json').reply(200, null);
        const promise = calmHubDocumentLoader.loadMissingDocument('calm:/schemas/2025-03/meta/null-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });

    it('throws when response is an array', async () => {
        mock.onGet('/schemas/2025-03/meta/array-response.json').reply(200, [{ '$id': 'foo' }]);
        const promise = calmHubDocumentLoader.loadMissingDocument('calm:/schemas/2025-03/meta/array-response.json', 'schema');
        await expect(promise).rejects.toBeInstanceOf(DocumentLoadError);
        await expect(promise).rejects.toThrow('Expected a JSON object');
    });
});