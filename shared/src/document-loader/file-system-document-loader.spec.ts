import { fs, vol } from 'memfs';
import { FileSystemDocumentLoader } from './file-system-document-loader';
import { DocumentLoadError } from './document-loader';

vi.mock('fs/promises', async () => {
    // const memfs = await vi.importActual("memfs");
    const memfs: { fs: typeof fs } = await vi.importActual('memfs')

    // Support both `import fs from "fs"` and "import { readFileSync } from "fs"`
    // return { default: memfs.fs, ...(typeof memfs.fs === 'object' ? memfs.fs : {}) };
    return memfs.fs.promises;
})

const mocks = vi.hoisted(() => {
    return {
        schemaDirectory: {
            storeDocument: vi.fn()
        },
    }
});

const exampleSchema = {
    '$id': 'https://example.com/test_schema.json',
    'type': 'object',
    'properties': {
        'name': { 'type': 'string' }
    }
};

describe('my-suite', () => {
    let fileSystemDocumentLoader;
    beforeEach(() => {
        process.chdir('/')
        vol.fromJSON({
            'test_fixtures/test_schema.json': JSON.stringify(exampleSchema)
        })
        fileSystemDocumentLoader = new FileSystemDocumentLoader(['test_fixtures'], false);
    });

    afterEach(() => {
        vol.reset();
    });


    it('loads a single schema into schema directory', async () => {
        await fileSystemDocumentLoader.initialise(mocks.schemaDirectory);
        expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(exampleSchema['$id'], 'schema', exampleSchema);
    });

    it('throws an error when trying to load a missing schema', async () => {
        await expect(fileSystemDocumentLoader.loadMissingDocument('https://example.com/missing_schema.json', 'schema'))
            .rejects
            .toThrow(DocumentLoadError);
    });
})