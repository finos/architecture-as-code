import { SchemaDirectory } from '.';
import { DocumentLoader } from './document-loader/document-loader';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('./logger', () => {
    return {
        initLogger: () => {
            return {
                info: () => {},
                debug: () => {},
                warn: () => {},
                error: () => {}
            };
        }
    };
});

function getMockDocumentLoader(): DocumentLoader {
    return {
        initialise: vi.fn(),
        loadMissingDocument: vi.fn()
    };
}

describe('SchemaDirectory', () => {
    let mockDocLoader;

    beforeEach(() => {
        mockDocLoader = getMockDocumentLoader();
    });

    it('calls documentloader initialise', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();
        expect(mockDocLoader.initialise).toHaveBeenCalled();
    });


    it('calls loadMissingDocument method when trying to resolve a spec not loaded at startup', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();

        const expectedValue = {'$id': 'abcd'};
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(expectedValue);

        const returnedSchema = await schemaDir.getSchema('mock id');
        expect(returnedSchema).toEqual(expectedValue);
    });


    it('resolves a reference from a stored schema', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        const nodeJson = loadSchema(path.join(__dirname, '../../calm/release/1.0/meta/core.json'));
        const nodeRef = 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node';
        
        mockDocLoader.loadMissingDocument.mockReturnValueOnce(new Promise(resolve => resolve(nodeJson)));

        const nodeDef = await schemaDir.getDefinition(nodeRef);

        // node should have a required property of node-type
        expect(nodeDef['required']).toContain('node-type');
    });

    it('recursively resolve references from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(
            loadSchema('test_fixtures/schema-directory/references.json')
        );
        
        const ref = 'https://calm.com/references.json#/defs/top-level';
        const definition = await schemaDir.getDefinition(ref);

        // this should include top-level, but also recursively pull in inner-prop
        expect(definition['properties']).toHaveProperty('top-level');
        expect(definition['properties']).toHaveProperty('inner-prop');
    });
    
    it('qualify relative references within same file to absolute IDs', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(loadSchema('test_fixtures/schema-directory/relative-ref.json'));
        
        const ref = 'https://calm.com/relative.json#/defs/top-level';
        const definition = await schemaDir.getDefinition(ref);

        expect(definition['$ref']).toEqual('https://calm.com/relative.json#/defs/inner');
    });

    it('throw error if doc loader fails to return a requested schema', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockRejectedValue(new Error('test error'));

        const ref = 'https://calm.com/missing-inner-ref.json#/defs/top-level';
        await expect(schemaDir.getDefinition(ref)).rejects.toThrow('test error');

    });

    it('throw error if returned schema does not contain given def', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(
            loadSchema('test_fixtures/schema-directory/missing-inner-ref.json')
        );
        
        const ref = 'https://calm.com/missing-inner-ref.json#/defs/top-level';
        const missingRef = '/defs/not-found'; // see missing-inner-ref.json
        const definition = await schemaDir.getDefinition(ref);

        expect(definition['properties']).toHaveProperty('missing-value');
        expect(definition['properties']['missing-value']).toEqual('MISSING OBJECT, ref: ' + missingRef + ' could not be resolved');
    });

    it('terminate early in the case of a circular reference', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(
            loadSchema('test_fixtures/schema-directory/recursive.json')
        );
        
        const ref = 'https://calm.com/recursive.json#/defs/top-level';
        const definition = await schemaDir.getDefinition(ref);

        // this should include top-level and port. If circular refs are not handled properly this will crash the whole test by stack overflow
        expect(definition['properties']).toHaveProperty('top-level');
        expect(definition['properties']).toHaveProperty('prop');
    });

    it('look up self-definitions without schema ID at top level from the pattern itself', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        mockDocLoader.loadMissingDocument.mockResolvedValueOnce(
            loadSchema('test_fixtures/schema-directory/relative-ref.json')
        );
        
        const ref = 'https://calm.com/relative.json#/defs/top-level';
        const definition = await schemaDir.getDefinition(ref);

        // this should include top-level, but also recursively pull in inner-prop
        expect(definition['properties']).toHaveProperty('top-level');
        expect(definition['properties']).toHaveProperty('inner-prop');
    });
});

function loadSchema(path: string): object {
    const def = readFileSync(path, 'utf-8');
    return JSON.parse(def);
}