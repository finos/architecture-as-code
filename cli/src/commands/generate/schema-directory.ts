import { readdir, readFile } from "fs/promises";
import { join } from "path";
import pointer from 'json-pointer'

export class SchemaDirectory {
    private readonly schemas: Map<string, any> = new Map<string, any>();

    constructor(private directoryPath: string) {}

    public async loadSchemas() {
        console.log("Loading from " + this.directoryPath)
        const files = await readdir(this.directoryPath, { recursive: true });

        const schemaPaths = files.filter(str => str.match(/^.*(json|yaml|yml)$/))
            .map(schemaPath => join(this.directoryPath, schemaPath))

        // console.log(schemaPaths)

        for (const schemaPath of schemaPaths) {
            await this.loadSchema(schemaPath)
        }

        console.log(`Loaded ${this.schemas.size} schemas.`)
    }

    public getDefinition(definitionReference: string) {
        const [schemaId, ref] = definitionReference.split("#")
        const schema = this.getSchema(schemaId)
        console.log(schemaId)
        console.log(ref)
        console.log(schema)
        return pointer.get(schema, ref)
    }

    public getSchema(schemaId: string) {
        if (!this.schemas.has(schemaId)) {
            const registered = [...this.schemas.keys()];
            console.error(`Schema with $id ${schemaId} not found. Registered schemas: ${registered}`)
            throw new Error(`Schema with $id ${schemaId} not found.`)
        }
        // console.log(this.schemas.get(schemaId))
        return this.schemas.get(schemaId)
    }

    private async loadSchema(schemaPath: string) {
        console.log("Loading " + schemaPath)
        const str = await readFile(schemaPath, 'utf-8')
        const parsed = JSON.parse(str)
        const schemaId = parsed['$id']

        if (!schemaId) {
            console.error("Bad schema found, no $id found. Path: ", schemaPath)
        }
        console.log("Loaded schema with $id: " + schemaId)
        // console.log(parsed)
        
        this.schemas.set(schemaId, parsed)
    }

}