import { SchemaDirectory } from '../schema-directory';
import { fs, vol } from 'memfs';
import path from 'path';
import { FileSystemDocumentLoader } from './file-system-document-loader';
import { DocumentLoadError } from './document-loader';

vi.mock('fs/promises', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');

    return memfs.fs.promises;
});

vi.mock('fs', async () => {
    const memfs: { fs: typeof fs } = await vi.importActual('memfs');
    return memfs.fs;
});

const mocks = vi.hoisted(() => {
    return {
        schemaDirectory: {
            storeDocument: vi.fn()
        },
    };
});

const exampleSchema = {
    '$id': 'https://example.com/test_schema.json',
    'type': 'object',
    'properties': {
        'name': { 'type': 'string' }
    }
};

describe('file-system-document-loader', () => {
    let fileSystemDocumentLoader: FileSystemDocumentLoader;
    beforeEach(() => {
        process.chdir('/');
        vol.fromJSON({
            'test_fixtures/test_schema.json': JSON.stringify(exampleSchema)
        });
        fileSystemDocumentLoader = new FileSystemDocumentLoader(['test_fixtures'], false);
    });

    afterEach(() => {
        vol.reset();
    });


    it('loads a single schema into schema directory', async () => {
        await fileSystemDocumentLoader.initialise(mocks.schemaDirectory as unknown as SchemaDirectory);
        expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(exampleSchema['$id'], 'schema', exampleSchema);
    });

    it('throws an error when trying to load a missing schema', async () => {
        await expect(fileSystemDocumentLoader.loadMissingDocument('https://example.com/missing_schema.json', 'schema'))
            .rejects
            .toThrow(DocumentLoadError);
    });
    it('resolves relative paths when basePath is provided', async () => {
        const loader = new FileSystemDocumentLoader(['test_fixtures'], false, '/project');
        vol.fromJSON({
            '/project/subdir/relative.json': JSON.stringify(exampleSchema)
        });

        const result = await loader.loadMissingDocument('subdir/relative.json', 'schema');
        expect(result).toEqual(exampleSchema);
    });

    it('returns undefined for resolvePath when no basePath provided', () => {
        const loader = new FileSystemDocumentLoader(['test_fixtures'], false);
        expect(loader.resolvePath('some/path.json')).toBeUndefined();
    });

    it('resolves absolute path when resolvePath is called with relative path and basePath', () => {
        const loader = new FileSystemDocumentLoader(['test_fixtures'], false, '/project');
        expect(loader.resolvePath('subdir/file.json')).toBe(path.join('/project', 'subdir', 'file.json'));
    });

    it('reports a missing local file as a non-recoverable ENOENT error', async () => {
        const thrown = await fileSystemDocumentLoader.loadMissingDocument('missing.json', 'architecture').catch((e) => e);
        expect(thrown).toBeInstanceOf(DocumentLoadError);
        expect(thrown).toMatchObject({ recoverable: false });
        expect(thrown.message).toBe(`ENOENT: no such file or directory, open '${path.resolve('missing.json')}'`);
    });

    it('reports a missing file under the base path with its resolved path', async () => {
        const loader = new FileSystemDocumentLoader(['test_fixtures'], false, '/project');
        const thrown = await loader.loadMissingDocument('standards/missing.json', 'standard').catch((e) => e);
        expect(thrown).toMatchObject({ recoverable: false });
        expect(thrown.message).toContain(`'${path.join('/project', 'standards', 'missing.json')}'`);
    });

    it('reports invalid JSON in a local file as non-recoverable and names the file', async () => {
        vol.fromJSON({ '/broken.json': '{ nope' });
        const thrown = await fileSystemDocumentLoader.loadMissingDocument('broken.json', 'architecture').catch((e) => e);
        expect(thrown).toBeInstanceOf(DocumentLoadError);
        expect(thrown).toMatchObject({ recoverable: false });
        expect(thrown.message.startsWith(`${path.resolve('broken.json')} is not valid JSON: `)).toBe(true);
        expect(thrown.cause).toBeInstanceOf(SyntaxError);
    });

    it('keeps a missing URL reference recoverable so other loaders can try it', async () => {
        const thrown = await fileSystemDocumentLoader.loadMissingDocument('https://example.com/missing_schema.json', 'schema').catch((e) => e);
        expect(thrown).toMatchObject({ recoverable: true, name: 'OPERATION_NOT_IMPLEMENTED' });
    });

    it.each(['HTTPS://example.com/missing_schema.json', 'urn:example:missing-schema'])(
        'keeps a missing %s reference recoverable so other loaders can try it', async (reference) => {
            const thrown = await fileSystemDocumentLoader.loadMissingDocument(reference, 'schema').catch((e) => e);
            expect(thrown).toMatchObject({ recoverable: true, name: 'OPERATION_NOT_IMPLEMENTED' });
        });

    it.each(['urn:example:schema', 'HTTPS://example.com/schema.json', 'calm:/namespaces/x'])(
        'does not resolve %s against the base path', (reference) => {
            const loader = new FileSystemDocumentLoader(['test_fixtures'], false, '/project');
            expect(loader.resolvePath(reference)).toBeUndefined();
        });

    it('keeps the no-$id schema fallback recoverable', async () => {
        vol.fromJSON({ '/no-id.json': JSON.stringify({ type: 'object' }) });
        const thrown = await fileSystemDocumentLoader.loadMissingDocument('no-id.json', 'schema').catch((e) => e);
        expect(thrown).toMatchObject({ recoverable: true, name: 'OPERATION_NOT_IMPLEMENTED' });
    });
});