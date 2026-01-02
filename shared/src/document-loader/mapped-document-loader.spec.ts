import { fs, vol } from 'memfs';
import { MappedDocumentLoader } from './mapped-document-loader';
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

const exampleSchema1 = {
    '$id': 'https://example.com/schema1.json',
    'type': 'object'
};

const exampleSchema2 = {
    '$id': 'https://example.com/schema2.json',
    'type': 'string'
};

describe('MappedDocumentLoader', () => {
    beforeEach(() => {
        process.chdir('/');
        vol.reset();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vol.reset();
    });

    describe('initialise', () => {
        it('should pre-load all mapped documents into schema directory', async () => {
            vol.fromJSON({
                '/project/standards/schema1.json': JSON.stringify(exampleSchema1),
                '/project/standards/schema2.json': JSON.stringify(exampleSchema2)
            });

            const urlMap = new Map([
                ['https://mapped.example.com/schema1.json', 'standards/schema1.json'],
                ['https://mapped.example.com/schema2.json', 'standards/schema2.json']
            ]);

            const loader = new MappedDocumentLoader(urlMap, '/project', false);
            await loader.initialise(mocks.schemaDirectory);

            // Should store by mapped URL
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(
                'https://mapped.example.com/schema1.json',
                'schema',
                exampleSchema1
            );
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(
                'https://mapped.example.com/schema2.json',
                'schema',
                exampleSchema2
            );

            // Should also store by $id
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(
                'https://example.com/schema1.json',
                'schema',
                exampleSchema1
            );
            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(
                'https://example.com/schema2.json',
                'schema',
                exampleSchema2
            );
        });

        it('should handle missing mapped files gracefully', async () => {
            vol.fromJSON({});

            const urlMap = new Map([
                ['https://example.com/missing.json', 'nonexistent.json']
            ]);

            const loader = new MappedDocumentLoader(urlMap, '/project', false);
            
            // Should not throw
            await expect(loader.initialise(mocks.schemaDirectory)).resolves.not.toThrow();
            
            // Should not store anything
            expect(mocks.schemaDirectory.storeDocument).not.toHaveBeenCalled();
        });

        it('should handle absolute paths in mappings', async () => {
            vol.fromJSON({
                '/absolute/path/schema.json': JSON.stringify(exampleSchema1)
            });

            const urlMap = new Map([
                ['https://mapped.example.com/abs.json', '/absolute/path/schema.json']
            ]);

            const loader = new MappedDocumentLoader(urlMap, '/other/path', false);
            await loader.initialise(mocks.schemaDirectory);

            expect(mocks.schemaDirectory.storeDocument).toHaveBeenCalledWith(
                'https://mapped.example.com/abs.json',
                'schema',
                exampleSchema1
            );
        });
    });

    describe('loadMissingDocument', () => {
        it('should resolve document via URL mapping', async () => {
            vol.fromJSON({
                '/project/standards/test.json': JSON.stringify(exampleSchema1)
            });

            const urlMap = new Map([
                ['https://mapped.example.com/test.json', 'standards/test.json']
            ]);

            const loader = new MappedDocumentLoader(urlMap, '/project', false);
            const result = await loader.loadMissingDocument('https://mapped.example.com/test.json', 'schema');

            expect(result).toEqual(exampleSchema1);
        });



        it('should throw for URLs not in mapping', async () => {
            vol.fromJSON({});
            const loader = new MappedDocumentLoader(new Map(), '/project', false);

            await expect(loader.loadMissingDocument('https://unknown.example.com/foo.json', 'schema'))
                .rejects.toThrow(DocumentLoadError);
        });

        it('should throw for non-existent relative paths', async () => {
            vol.fromJSON({});
            const loader = new MappedDocumentLoader(new Map(), '/project', false);

            await expect(loader.loadMissingDocument('nonexistent.json', 'schema'))
                .rejects.toThrow(DocumentLoadError);
        });

        it('should not treat absolute URLs as relative paths', async () => {
            vol.fromJSON({});
            const loader = new MappedDocumentLoader(new Map(), '/project', false);

            await expect(loader.loadMissingDocument('https://example.com/schema.json', 'schema'))
                .rejects.toThrow(DocumentLoadError);
        });

        it('should not treat file:// URLs as relative paths', async () => {
            vol.fromJSON({});
            const loader = new MappedDocumentLoader(new Map(), '/project', false);

            await expect(loader.loadMissingDocument('file:///absolute/path.json', 'schema'))
                .rejects.toThrow(DocumentLoadError);
        });

        it('should not treat calm: protocol as relative paths', async () => {
            vol.fromJSON({});
            const loader = new MappedDocumentLoader(new Map(), '/project', false);

            await expect(loader.loadMissingDocument('calm://namespace/schema', 'schema'))
                .rejects.toThrow(DocumentLoadError);
        });
    });

    describe('URL mapping takes precedence over relative path', () => {
        it('should use mapping even if relative file exists', async () => {
            const mappedSchema = { '$id': 'mapped', 'type': 'object' };
            const relativeSchema = { '$id': 'relative', 'type': 'string' };
            
            vol.fromJSON({
                '/project/mapped.json': JSON.stringify(mappedSchema),
                '/project/schema.json': JSON.stringify(relativeSchema)
            });

            const urlMap = new Map([
                ['schema.json', 'mapped.json']  // Maps the relative path to a different file
            ]);

            const loader = new MappedDocumentLoader(urlMap, '/project', false);
            const result = await loader.loadMissingDocument('schema.json', 'schema');

            expect(result).toEqual(mappedSchema);
        });
    });
});
