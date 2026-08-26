import { describe, it, expect, vi } from 'vitest';
import { InMemoryDocumentLoader } from './in-memory-document-loader';
import { DocumentLoadError } from './document-loader';
import { SchemaDirectory } from '../schema-directory';

const CORE = { $id: 'https://calm.finos.org/release/1.2/meta/core.json', $schema: 'https://json-schema.org/draft/2020-12/schema' };
const ARCH = { 'unique-id': 'arch', nodes: [], relationships: [] };

describe('InMemoryDocumentLoader', () => {
    it('stores every document with a $id into the schema directory on initialise', async () => {
        const loader = new InMemoryDocumentLoader({ [CORE.$id]: CORE, 'https://x/arch.json': ARCH });
        const schemaDirectory = { storeDocument: vi.fn() } as unknown as SchemaDirectory;
        await loader.initialise(schemaDirectory);
        expect(schemaDirectory.storeDocument).toHaveBeenCalledTimes(1);
        expect(schemaDirectory.storeDocument).toHaveBeenCalledWith(CORE.$id, 'schema', CORE);
    });

    it('serves documents by id regardless of type', async () => {
        const loader = new InMemoryDocumentLoader({ 'https://x/arch.json': ARCH });
        await expect(loader.loadMissingDocument('https://x/arch.json', 'architecture')).resolves.toBe(ARCH);
    });

    it('throws a recoverable OPERATION_NOT_IMPLEMENTED error for unknown ids', async () => {
        const loader = new InMemoryDocumentLoader({});
        await expect(loader.loadMissingDocument('https://x/missing.json', 'schema')).rejects.toMatchObject({
            name: 'OPERATION_NOT_IMPLEMENTED',
            recoverable: true,
        });
        await expect(loader.loadMissingDocument('https://x/missing.json', 'schema')).rejects.toBeInstanceOf(DocumentLoadError);
    });

    it('never resolves references to local paths', () => {
        expect(new InMemoryDocumentLoader({}).resolvePath('./foo.json')).toBeUndefined();
    });

    it('lets SchemaDirectory resolve a missing schema to undefined', async () => {
        const schemaDirectory = new SchemaDirectory(new InMemoryDocumentLoader({ [CORE.$id]: CORE }));
        await schemaDirectory.loadSchemas();
        expect(schemaDirectory.getLoadedSchemas()).toEqual([CORE.$id]);
        await expect(schemaDirectory.getSchema('https://x/nope.json')).resolves.toBeUndefined();
    });
});
