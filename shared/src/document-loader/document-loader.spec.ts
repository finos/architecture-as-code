import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { buildDocumentLoader, DocumentLoaderOptions } from './document-loader';

const mocks = vi.hoisted(() => {
    return {
        fsDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        })),
        calmHubDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        }))
    };
});


vi.mock('./file-system-document-loader', () => {
    return {
        FileSystemDocumentLoader: mocks.fsDocLoader
    };
});

vi.mock('./calmhub-document-loader', () => {
    return {
        CalmHubDocumentLoader: mocks.calmHubDocLoader
    };
});

describe('DocumentLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should create a FileSystemDocumentLoader when loadMode is "filesystem"', () => {

        const docLoaderOpts: DocumentLoaderOptions = {
            schemaDirectoryPath: 'schemas'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.fsDocLoader).toHaveBeenCalledWith([CALM_META_SCHEMA_DIRECTORY, 'schemas'], false);
    });

    it('should create a CalmHubDocumentLoader when loadMode is "calmhub"', () => {

        const docLoaderOpts: DocumentLoaderOptions = {
            calmHubUrl: 'https://example.com'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.calmHubDocLoader).toHaveBeenCalledWith('https://example.com', false);
    });
});