import { readdir, readFile } from "fs/promises";
import { join } from "path";
import pointer from 'json-pointer'
import { mergeSchemas } from "./util.js";
import { Logger } from "winston";
import { initLogger } from "../helper.js";

export class SchemaDirectory {
    private readonly schemas: Map<string, any> = new Map<string, any>();
    private readonly logger: Logger;

    constructor(private directoryPath: string, debug: boolean = false) {
        this.logger = initLogger(debug);
    }

    public async loadSchemas() {
        this.logger.debug("Loading schemas from " + this.directoryPath)
        const files = await readdir(this.directoryPath, { recursive: true });

        const schemaPaths = files.filter(str => str.match(/^.*(json|yaml|yml)$/))
            .map(schemaPath => join(this.directoryPath, schemaPath))

        for (const schemaPath of schemaPaths) {
            await this.loadSchema(schemaPath)
        }

        this.logger.info(`Loaded ${this.schemas.size} schemas.`)
    }

    private lookupDefinition(schemaId: string, ref: string) {
        const schema = this.getSchema(schemaId)
        if (!schema) {
            return undefined
        }
        // TODO propagate the required fields
        return pointer.get(schema, ref)
    }

    private getDefinitionRecursive(definitionReference: string, currentSchemaId: string) {
        let [newSchemaId, ref] = definitionReference.split("#")

        if (!newSchemaId) {
            newSchemaId = currentSchemaId;
            this.logger.debug(`Resolving reference ${ref} against current schema.`)
        }
        this.logger.debug(`Recursively resolving the reference, ref: ${ref}`)
        const definition = this.lookupDefinition(newSchemaId, ref);
        if (!definition) {
            // schema not defined
            // TODO enforce this once we can guarantee we always have schemas available
            return {}
        }
        if (!definition['$ref']) {
            this.logger.debug("Reached a definition with no ref, terminating recursive lookup.")
            return definition
        }
        const newRef: string = definition['$ref']
        const innerDef = this.getDefinitionRecursive(newRef, newSchemaId)
        return mergeSchemas(innerDef, definition)
    }

    public getDefinition(definitionReference: string) {
        this.logger.debug(`Resolving ${definitionReference} from schema directory.`)
        return this.getDefinitionRecursive(definitionReference, "pattern")
        // // TODO propagate the required fields
    }

    public getSchema(schemaId: string) {
        if (!this.schemas.has(schemaId)) {
            const registered = [...this.schemas.keys()];
            this.logger.warn(`Schema with $id ${schemaId} not found. Returning empty object. Registered schemas: ${registered}`)
            return undefined;
        }
        return this.schemas.get(schemaId)
    }

    private async loadSchema(schemaPath: string) {
        console.log("Loading " + schemaPath)
        const str = await readFile(schemaPath, 'utf-8')
        const parsed = JSON.parse(str)
        const schemaId = parsed['$id']

        if (!schemaId) {
            this.logger.warn("Warning: bad schema found, no $id property was defined. Path: ", schemaPath)
            return
        }
        this.logger.debug("Loaded schema with $id: " + schemaId)
        
        this.schemas.set(schemaId, parsed)
    }

}