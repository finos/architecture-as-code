import { SchemaDirectory } from '.';
import { DocumentLoader } from './document-loader/document-loader';
import { readFile, readFileSync } from 'node:fs';

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
    }
}

describe('SchemaDirectory', () => {
    let mockDocLoader;
    let mockLoadMissingDocument;

    beforeEach(() => {
        mockDocLoader = getMockDocumentLoader();
        // mockLoadMissingDocument = vi.fn();
    })

    it('calls documentloader initialise', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();
        expect(mockDocLoader.initialise).toHaveBeenCalled();
    });


    it('calls loadMissingDocument method when trying to resolve a spec not loaded at startup', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();

        const expectedValue = {'$id': 'abcd'};
        mockDocLoader.loadMissingDocument.mockReturnValueOnce(new Promise(resolve => resolve(expectedValue)));

        const returnedSchema = await schemaDir.getSchema('mock id');
        expect(returnedSchema).toEqual(expectedValue)
    })


    it('resolves a reference from a stored schema', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        const nodeJson = loadSchema('test_fixtures/calm/core.json')
        const nodeRef = 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node';
        
        mockDocLoader.loadMissingDocument.mockReturnValueOnce(new Promise(resolve => resolve(nodeJson)));

        const nodeDef = await schemaDir.getDefinition(nodeRef);

        // node should have a required property of node-type
        expect(nodeDef['required']).toContain('node-type');
    });

    it('recursively resolve references from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();
        const interfaceRef = 'https://calm.finos.org/draft/2025-03/meta/interface.json#/defs/host-port-interface';
        mockDocLoader.loadMissingDocument.mockReturnValue(new Promise(resolve => 
            resolve(loadSchema('../../calm/draft/2025-03/meta/interface.json'))));
        mockDocLoader.loadMissingDocument.mockReturnValue(new Promise(resolve => 
            resolve(loadSchema('../../calm/draft/2025-03/meta/core.json'))));


        const resolvedDefinition = await schemaDir.getDefinition(interfaceRef);

        // this should include host and port, but also recursively include unique-id
        expect(resolvedDefinition['properties']).toHaveProperty('host');
        expect(resolvedDefinition['properties']).toHaveProperty('port');
        expect(resolvedDefinition['properties']).toHaveProperty('unique-id');
    });
    
    it('qualify relative references within same file to absolute IDs', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        // mockDocLoader.
        await schemaDir.loadSchemas();
        
        mockDocLoader.loadMissingDocument.mockReturnValue(new Promise(resolve => 
            resolve(loadSchema('../../calm/draft/2025-03/meta/core.json'))));
        mockDocLoader.loadMissingDocument.mockReturnValue(new Promise(resolve => 
            resolve(loadSchema('../../calm/draft/2025-03/meta/interface.json'))));
        
        const interfaceRef = 'https://calm.finos.org/draft/2025-03/meta/interface.json#/defs/rate-limit-interface';
        const interfaceDef = await schemaDir.getDefinition(interfaceRef);

        expect(interfaceDef['properties']['key']['$ref']).toEqual('https://calm.finos.org/draft/2025-03/meta/interface.json#/defs/rate-limit-interface');
    });

    // it('resolve to warning message if schema is missing', async () => {
    //     const schemaDir = new SchemaDirectory();
        
    //     const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface';
    //     const interfaceDef = schemaDir.getDefinition(interfaceRef);

    //     // this should include host and port, but also recursively include unique-id
    //     expect(interfaceDef.properties).toHaveProperty('missing-value');
    //     expect(interfaceDef.properties['missing-value']).toEqual('MISSING OBJECT, ref: ' + interfaceRef + ' could not be resolved');
    // });



    // it('terminate early in the case of a circular reference', async () => {
    //     const schemaDir = new SchemaDirectory();
        
    //     await schemaDir.loadSchemas('test_fixtures/recursive_refs');
    //     const interfaceRef = 'https://calm.com/recursive.json#/$defs/top-level';
    //     const interfaceDef = schemaDir.getDefinition(interfaceRef);

    //     // this should include top-level and port. If circular refs are not handled properly this will crash the whole test by stack overflow
    //     expect(interfaceDef.properties).toHaveProperty('top-level');
    //     expect(interfaceDef.properties).toHaveProperty('prop');
    // });

    // it('look up self-definitions without schema ID at top level from the pattern itself', async () => {
    //     const schemaDir = new SchemaDirectory();

    //     await schemaDir.loadSchemas(__dirname + '/../../calm/draft/2024-04');

    //     const selfRefPatternStr = await readFile('test_fixtures/api-gateway-self-reference.json', 'utf-8');
    //     const selfRefPattern = JSON.parse(selfRefPatternStr);

    //     schemaDir.loadCurrentPatternAsSchema(selfRefPattern);


    //     const nodeDef = schemaDir.getDefinition('#/defs/sample-node');
    //     expect(nodeDef.properties).toHaveProperty('extra-prop');
    // });
});

function loadSchema(path: string): object {
    const def = readFileSync('test_fixtures/calm/core.json', 'utf-8');
    return JSON.parse(def);
}