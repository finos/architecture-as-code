import { SchemaDirectoryReferenceResolver } from './schema-directory-reference-resolver';
import { SchemaDirectory } from '../schema-directory';

describe('SchemaDirectoryReferenceResolver', () => {
    it('canResolve is true when a schema directory is present', () => {
        const dir = { loadDocument: vi.fn() } as unknown as SchemaDirectory;
        const resolver = new SchemaDirectoryReferenceResolver(dir);
        expect(resolver.canResolve('any')).toBe(true);
    });

    it('canResolve is false when no schema directory is present', () => {
        const resolver = new SchemaDirectoryReferenceResolver(undefined);
        expect(resolver.canResolve('any')).toBe(false);
    });

    it('resolves by loading the document as an architecture by default', async () => {
        const loadDocument = vi.fn().mockResolvedValue({ doc: true });
        const dir = { loadDocument } as unknown as SchemaDirectory;
        const resolver = new SchemaDirectoryReferenceResolver(dir);

        const result = await resolver.resolve('https://example.com/a.json');

        expect(result).toEqual({ doc: true });
        expect(loadDocument).toHaveBeenCalledWith('https://example.com/a.json', 'architecture');
    });

    it('honours a custom document type', async () => {
        const loadDocument = vi.fn().mockResolvedValue({});
        const dir = { loadDocument } as unknown as SchemaDirectory;
        const resolver = new SchemaDirectoryReferenceResolver(dir, 'pattern');

        await resolver.resolve('ref');

        expect(loadDocument).toHaveBeenCalledWith('ref', 'pattern');
    });

    it('rejects when resolving without a schema directory', async () => {
        const resolver = new SchemaDirectoryReferenceResolver(undefined);
        await expect(resolver.resolve('ref')).rejects.toThrow('without a schema directory');
    });
});
