import { SchemaDirectory } from './schema-directory';
import { readFile } from 'node:fs/promises';

jest.mock('../helper', () => {
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

describe('SchemaDirectory', () => {
    it('loads all specs from given directory including subdirectories', async () => {
        const schemaDir = new SchemaDirectory();
        
        await schemaDir.loadSchemas('../calm/draft/2024-03');
        expect(schemaDir.getLoadedSchemas().length).toBe(2);
    });

    it('resolves a reference from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory();
        
        await schemaDir.loadSchemas('../calm/draft/2024-03');
        const nodeRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-03/meta/core.json#/defs/node';
        const nodeDef = schemaDir.getDefinition(nodeRef);

        // node should have a required property of node-type
        expect(nodeDef.required).toContain('node-type');
    });

    it('recursively resolve references from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory();
        
        await schemaDir.loadSchemas('../calm/draft/2024-04');
        const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface';
        const interfaceDef = schemaDir.getDefinition(interfaceRef);

        // this should include host and port, but also recursively include unique-id
        expect(interfaceDef.properties).toHaveProperty('host');
        expect(interfaceDef.properties).toHaveProperty('port');
        expect(interfaceDef.properties).toHaveProperty('unique-id');
    });
    
    it('qualify relative references within same file to absolute IDs', async () => {
        const schemaDir = new SchemaDirectory();
        
        await schemaDir.loadSchemas('../calm/draft/2024-04');
        const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/rate-limit-interface';
        const interfaceDef = schemaDir.getDefinition(interfaceRef);

        expect(interfaceDef['properties']['key']['$ref']).toEqual('https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/rate-limit-key');
    });

    it('resolve to warning message if schema is missing', async () => {
        const schemaDir = new SchemaDirectory();
        
        const interfaceRef = 'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface';
        const interfaceDef = schemaDir.getDefinition(interfaceRef);

        // this should include host and port, but also recursively include unique-id
        expect(interfaceDef.properties).toHaveProperty('missing-value');
        expect(interfaceDef.properties['missing-value']).toEqual('MISSING OBJECT, ref: ' + interfaceRef + ' could not be resolved');
    });

    it('terminate early in the case of a circular reference', async () => {
        const schemaDir = new SchemaDirectory();
        
        await schemaDir.loadSchemas('test_fixtures/recursive_refs');
        const interfaceRef = 'https://calm.com/recursive.json#/$defs/top-level';
        const interfaceDef = schemaDir.getDefinition(interfaceRef);

        // this should include top-level and port. If circular refs are not handled properly this will crash the whole test by stack overflow
        expect(interfaceDef.properties).toHaveProperty('top-level');
        expect(interfaceDef.properties).toHaveProperty('prop');
    });

    it('look up self-definitions without schema ID at top level from the pattern itself', async () => {
        const schemaDir = new SchemaDirectory();

        await schemaDir.loadSchemas('../calm/draft/2024-04');

        const selfRefPatternStr = await readFile('test_fixtures/api-gateway-self-reference.json', 'utf-8');
        const selfRefPattern = JSON.parse(selfRefPatternStr);

        schemaDir.loadCurrentPatternAsSchema(selfRefPattern);


        const nodeDef = schemaDir.getDefinition('#/defs/sample-node');
        expect(nodeDef.properties).toHaveProperty('extra-prop');
    });
});