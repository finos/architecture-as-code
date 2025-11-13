import { CalmHubCustomDocumentLoader } from './calmhub-custom-document-loader';
import { SchemaDirectory } from '../schema-directory';
import { execFileSync } from 'child_process';
import { constants } from 'os';
import { Mock } from 'vitest';
import { CALM_AUTH_PLUGIN_DIRECTORY } from '../consts';
import path from 'path';

const calmHubBaseUrl = 'http://local-calmhub';

vi.mock('child_process', () => ({
    execFileSync: vi.fn()
}));
const execFileSyncMock = (execFileSync as Mock);

describe('calmhub-custom-document-loader', () => {
    let calmHubDocumentLoader: CalmHubCustomDocumentLoader;
    let schemaDirectory: SchemaDirectory;
    beforeEach(() => {
        calmHubDocumentLoader = new CalmHubCustomDocumentLoader(calmHubBaseUrl, 'my-calmhub-wrapper', false);
        calmHubDocumentLoader.initialise(schemaDirectory);
        execFileSyncMock.mockClear();
    });

    it('loads a document from CalmHub', async () => {
        const calmHubUrl = 'calm:/schemas/2025-03/meta/core.json';

        const mockResponse = JSON.stringify({
            '$id': 'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'value': 'test'
        });

        execFileSyncMock.mockReturnValueOnce(mockResponse);

        const document = await calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema');
        expect(document).toEqual(JSON.parse(mockResponse));
        expect(execFileSyncMock).toHaveBeenCalledExactlyOnceWith(
            path.resolve(CALM_AUTH_PLUGIN_DIRECTORY, 'my-calmhub-wrapper'),
            ['--method', 'GET', calmHubBaseUrl + '/schemas/2025-03/meta/core.json'],
            { 'stdio': 'pipe', 'shell': true, 'encoding': 'utf-8', 'timeout': 30000 });
    });

    it('throws an error when the document is not found', async () => {
        const calmHubUrl = 'calm:/schemas/2025-03/meta/nonexistent.json';

        execFileSyncMock.mockImplementation(() => {
            throw {
                status: 404,
                stderr: '<p>Not Found</p>'
            };
        });

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
        expect(execFileSyncMock).toHaveBeenCalledExactlyOnceWith(
            path.resolve(CALM_AUTH_PLUGIN_DIRECTORY, 'my-calmhub-wrapper'),
            ['--method', 'GET', calmHubBaseUrl + '/schemas/2025-03/meta/nonexistent.json'],
            { 'stdio': 'pipe', 'shell': true, 'encoding': 'utf-8', 'timeout': 30000 });
    });

    it('throws an error when the wrapper fails:', async () => {
        const calmHubUrl = 'calm:/schemas/2025-03/meta/nonexistent.json';

        execFileSyncMock.mockImplementation(() => {
            throw {
                code: constants.errno.ENOENT
            };
        });

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
        expect(execFileSyncMock).toHaveBeenCalledOnce();
    });

    it('throws an error when the protocol is not calm:', async () => {
        const calmHubUrl = 'https://not.calmhub.com/schemas/2025-03/meta/nonexistent.json';

        await expect(calmHubDocumentLoader.loadMissingDocument(calmHubUrl, 'schema')).rejects.toThrow();
        expect(execFileSyncMock).not.toHaveBeenCalled();
    });
});