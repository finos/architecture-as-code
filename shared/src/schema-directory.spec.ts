import { SchemaDirectory } from '.';
import { DocumentLoader } from './document-loader/document-loader';
import { readFile } from 'node:fs/promises';

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
    it('calls documentloader initialise', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();
        expect(mockDocLoader.initialise).toHaveBeenCalled();
    });

    it('calls loadMissingDocument method when trying to resolve a spec not loaded at startup', async () => {
        const schemaDir = new SchemaDirectory(mockDocLoader);
        
        await schemaDir.loadSchemas();

        const expectedValue = {'$id': 'abcd'};
        mockLoadMissingDocument.mockReturnValueOnce(new Promise(resolve => resolve(expectedValue)));

        const returnedSchema = await schemaDir.getSchema('mock id');
        expect(returnedSchema).toEqual(expectedValue)
    })


    it.only('resolves a reference from a stored schema', async () => {
        const schemaDir = new SchemaDirectory(getMockDocumentLoader());
        
        // await schemaDir.loadSchemas();
        // await schemaDir.loadSchemas(__dirname + '/../../calm/draft/2024-03');

        const def = await readFile('test_fixtures/calm/core.json', 'utf-8')
        const json = JSON.parse(def);
        console.error(json)
        const nodeRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-03/meta/core.json#/defs/node';
        // const id = 'https://calm.finos.org/draft/2024-03/meta/core.json';
        
        mockLoadMissingDocument.mockReturnValueOnce(new Promise(resolve => resolve(json)));

        const nodeDef = schemaDir.getDefinition(nodeRef);

        // // node should have a required property of node-type
        // expect(nodeDef['required']).toContain('node-type');
    });

    // it('recursively resolve references from a loaded schema', async () => {
    //     const schemaDir = new SchemaDirectory();
        
    //     await schemaDir.loadSchemas(__dirname + '/../../calm/draft/2024-04');
    //     const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface';
    //     const interfaceDef = schemaDir.getDefinition(interfaceRef);

    //     // this should include host and port, but also recursively include unique-id
    //     expect(interfaceDef.properties).toHaveProperty('host');
    //     expect(interfaceDef.properties).toHaveProperty('port');
    //     expect(interfaceDef.properties).toHaveProperty('unique-id');
    // });
    
    // it('qualify relative references within same file to absolute IDs', async () => {
    //     const schemaDir = new SchemaDirectory();
        
    //     await schemaDir.loadSchemas(__dirname + '/../../calm/draft/2024-04');
    //     const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/rate-limit-interface';
    //     const interfaceDef = schemaDir.getDefinition(interfaceRef);

    //     expect(interfaceDef['properties']['key']['$ref']).toEqual('https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/rate-limit-key');
    // });

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