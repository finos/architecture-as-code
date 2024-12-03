import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pointer from 'json-pointer';
import { mergeSchemas, updateStringValuesRecursively } from './util.js';
import { Logger } from 'winston';
import { initLogger } from '../helper.js';

/**
 * Stores a directory of schemas and resolves references against that directory.
 * Can merge objects recursively and will handle circular references.
 */
export class SchemaDirectory {
    private readonly schemas: Map<string, object> = new Map<string, object>();
    private readonly logger: Logger;

    /**
     * Initialise the SchemaDirectory. Does not load the schemas until loadSchemas is called.
     * @param directoryPath The directory path from which to load schemas. All JSON and YAML files under this path will be loaded, including subfolders.
     * @param debug Whether to log at debug level.
     */
    constructor(debug: boolean = false) {
        this.logger = initLogger(debug);
    }

    public loadCurrentPatternAsSchema(pattern: object) {
        this.logger.debug('Loading current pattern as a schema.');
        this.schemas.set('pattern', pattern);
    }

    /**
     * Load the schemas from the configured directory path.
     * Subsequent loads could overwrite schemas if they have the same ID.
     */
    public async loadSchemas(dir: string): Promise<void> {
        try {
            const map = new Map<string, object>();

            this.logger.debug('Loading schemas from ' + dir);
            const files = await readdir(dir, { recursive: true });

            const schemaPaths = files.filter(str => str.match(/^.*(json|yaml|yml)$/))
                .map(schemaPath => join(dir, schemaPath));

            for (const schemaPath of schemaPaths) {
                const schema = await this.loadSchema(schemaPath);
                map.set(schema['$id'], schema);
            }

            map.forEach((val, key) => this.schemas.set(key, val));
            this.logger.info(`Loaded ${this.schemas.size} schemas.`);
        } catch (err) {
            if (err.code === 'ENOENT') {
                this.logger.error('Schema Path not found: ', dir, ', error: ', err);
            } else {
                this.logger.error(err);
            }
            process.exit(1);
        }
    }

    private lookupDefinition(schemaId: string, ref: string) {
        const schema = this.getSchema(schemaId);
        if (!schema) {
            return undefined;
        }
        return pointer.get(schema, ref);
    }

    private getDefinitionRecursive(definitionReference: string, currentSchemaId: string, visitedDefinitions: string[]) {
        const splitReference = definitionReference.split('#');
        let newSchemaId = splitReference[0];
        const ref = splitReference[1];
        visitedDefinitions.push(definitionReference);

        if (!newSchemaId) {
            newSchemaId = currentSchemaId;
            this.logger.debug(`Resolving reference ${ref} against current schema ${currentSchemaId}.`);
        }
        this.logger.debug(`Recursively resolving the reference, ref: ${ref}`);
        const definition = this.lookupDefinition(newSchemaId, ref);
        if (!definition) {
            // schema not defined
            // TODO enforce this once we can guarantee we always have schemas available
            return this.getMissingSchemaPlaceholder(definitionReference);
        }
        if (!definition['$ref']) {
            this.logger.debug('Reached a definition with no ref, terminating recursive lookup.');
            return this.qualifyLocalReferences(definition, newSchemaId);
        }
        const newRef: string = definition['$ref'];
        if (visitedDefinitions.includes(newRef)) {
            this.logger.warn('Circular reference detected. Terminating reference lookup. Visited definitions: ' + visitedDefinitions);
            return definition;
        }
        const innerDef = this.getDefinitionRecursive(newRef, newSchemaId, visitedDefinitions);
        const merged = mergeSchemas(innerDef, definition);
        const qualified = this.qualifyLocalReferences(merged, newSchemaId);
        return qualified;
    }

    private getMissingSchemaPlaceholder(reference: string) {
        return {
            properties: {
                'missing-value': `MISSING OBJECT, ref: ${reference} could not be resolved`
            }
        };
    }

    /**
     * 
     * @param definitionReference The reference to resolve. May be an absolute reference including a schema ID prefix, or a local reference.
     * @returns The resolved object, or an empty object if the object could not be resolved.
     */
    public getDefinition(definitionReference: string) {
        this.logger.debug(`Resolving ${definitionReference} from schema directory.`);
        const definition = this.getDefinitionRecursive(definitionReference, 'pattern', []);
        this.logger.debug(`Resolved definition ${JSON.stringify(definition, null, 2)}`);
        return definition;
    }

    /**
     * Once a definition has been resolved, we need to make sure the returned object has any leftover keys resolved against the schema they were fetched from.
     * The easiest way to do this is to qualify all local references (e.g #/defs/rate-limit-key) with their full schema ID.
     * That way when we instantiate them later, we have the ID of the schema they belong to.
     * @param definition  the definition object to look at references for
     * @param schemaId the schema ID to insert
     */
    public qualifyLocalReferences(definition: object, schemaId: string) {
        return updateStringValuesRecursively(definition, (key, value) => {
            if (key === '$ref' && value.startsWith('#')) {
                const newReference = schemaId + value;
                this.logger.debug(`Detected a local reference: ${value}. Qualifying the reference with schema ID during resolution. `);
                this.logger.debug(`Qualified reference: ${newReference}`);
                return newReference;
            }
            return value;
        });
    }

    /**
     * Return the list of all loaded schemas.
     */
    public getLoadedSchemas() {
        return [...this.schemas.keys()];
    }

    /**
     * Return the entire schema from the provided directory.
     * @param schemaId The ID of the schema to load.
     * @returns An entire schema as an object.
     */
    public getSchema(schemaId: string) {
        if (!this.schemas.has(schemaId)) {
            const registered = this.getLoadedSchemas();
            this.logger.warn(`Schema with $id ${schemaId} not found. Returning empty object. Registered schemas: ${registered}`);
            return undefined;
        }
        return this.schemas.get(schemaId);
    }

    private async loadSchema(schemaPath: string): Promise<object> {
        this.logger.debug('Loading ' + schemaPath);
        const str = await readFile(schemaPath, 'utf-8');
        const parsed = JSON.parse(str);
        const schemaId = parsed['$id'];

        if (!schemaId) {
            this.logger.warn('Warning: bad schema found, no $id property was defined. Path: ', schemaPath);
            return;
        }

        if (!parsed['$schema']) {
            this.logger.warn('Warning, loaded schema does not have $schema set and therefore may be invalid. Path: ', schemaPath);
        }

        this.logger.debug('Loaded schema with $id: ' + schemaId);
        
        return parsed;
    }
}