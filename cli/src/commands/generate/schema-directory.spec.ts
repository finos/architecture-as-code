import path from "node:path";
import { SchemaDirectory } from "./schema-directory"
import fs from 'node:fs'

// let schemaDirectory: SchemaDirectory

// beforeEach(() => {
//     schemaDirectory = new SchemaDirectory()
// })

describe('SchemaDirectory', () => {
    it('loads all specs from given directory including subdirectories', async () => {
        const schemaDir = new SchemaDirectory("../calm/draft/2024-03");
        
        await schemaDir.loadSchemas();
        expect(schemaDir.getLoadedSchemas().length).toBe(2);
    })

    it('resolves a reference from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory("../calm/draft/2024-03");
        
        await schemaDir.loadSchemas();
        const nodeRef = "https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/draft/2024-03/meta/core.json#/defs/node";
        const nodeDef = schemaDir.getDefinition(nodeRef);

        // node should have a required property of node-type
        expect(nodeDef.required).toContain('node-type')
    })

    it('recursively resolve references from a loaded schema', async () => {
        const schemaDir = new SchemaDirectory("../calm/draft/2024-04");
        
        await schemaDir.loadSchemas();
        const interfaceRef = "https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/draft/2024-04/meta/interface.json#/defs/host-port-interface";
        const interfaceDef = schemaDir.getDefinition(interfaceRef);

        // this should include host and port, but also recursively include unique-id
        expect(interfaceDef.properties).toHaveProperty('host')
        expect(interfaceDef.properties).toHaveProperty('port')
        expect(interfaceDef.properties).toHaveProperty('unique-id')
    })
})