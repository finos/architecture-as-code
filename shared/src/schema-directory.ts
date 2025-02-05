import pointer from 'json-pointer';
import { mergeSchemas, updateStringValuesRecursively } from './util.js';
import { Logger } from 'winston';
import { initLogger } from './logger.js';
import { CalmDocumentType } from './types.js';
import { DocumentLoader } from './document-loader/document-loader.js';

/**
 * Stores a directory of schemas and resolves references against that directory.
 * Can merge objects recursively and will handle circular references.
 */
export class SchemaDirectory {
    private readonly schemas: Map<string, object> = new Map<string, object>();
    private readonly schemaTypes: Map<string, CalmDocumentType> = new Map<string, CalmDocumentType>();
    private readonly logger: Logger;
    private readonly PATTERN_CURRENTLY_VALIDATING = 'patternCurrentlyValidating'
    private documentLoader: DocumentLoader;

    /**
     * Initialise the SchemaDirectory. Does not load the schemas until loadSchemas is called.
     * @param directoryPath The directory path from which to load schemas. All JSON and YAML files under this path will be loaded, including subfolders.
     * @param debug Whether to log at debug level.
     */
    constructor(documentLoader: DocumentLoader, debug: boolean = false) {
        this.logger = initLogger(debug);
        this.documentLoader = documentLoader;
    }

    public loadCurrentPatternAsSchema(pattern: object) {
        this.logger.debug('Loading current pattern as a schema.');
        this.schemas.set(this.PATTERN_CURRENTLY_VALIDATING, pattern);
        this.schemaTypes.set(this.PATTERN_CURRENTLY_VALIDATING, 'pattern')
    }

    /**
     * Initialise
     */
    public async loadSchemas(dir: string): Promise<void> {
        await this.documentLoader.initialise(this);
    }

    private async lookupDefinition(schemaId: string, ref: string): Promise<object> {
        const schema = await this.getSchema(schemaId);
        return pointer.get(schema, ref);
    }

    private async getDefinitionRecursive(definitionReference: string, currentSchemaId: string, visitedDefinitions: string[]): Promise<object> {
        const splitReference = definitionReference.split('#');
        let newSchemaId = splitReference[0];
        const ref = splitReference[1];
        visitedDefinitions.push(definitionReference);

        if (!newSchemaId) {
            newSchemaId = currentSchemaId;
            this.logger.debug(`Resolving reference ${ref} against current schema ${currentSchemaId}.`);
        }
        this.logger.debug(`Recursively resolving the reference, ref: ${ref}`);
        const definition = await this.lookupDefinition(newSchemaId, ref);
        if (!definition) {
            // schema not defined
            // TODO enforce this once we can guarantee we always have schemas available
            throw Error("schema missing!")
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
        const innerDef = await this.getDefinitionRecursive(newRef, newSchemaId, visitedDefinitions);
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
    public async getDefinition(definitionReference: string): Promise<object> {
        this.logger.debug(`Resolving ${definitionReference} from schema directory.`);
        const definition = await this.getDefinitionRecursive(definitionReference, this.PATTERN_CURRENTLY_VALIDATING, []);
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
    public async getSchema(schemaId: string): Promise<object> {
        if (!this.schemas.has(schemaId)) {
            const registered = this.getLoadedSchemas();
            // TODO type
            const document = await this.documentLoader.loadMissingDocument(schemaId, 'schema');
            this.storeDocument(schemaId, 'schema', document);

            return document
            // this.logger.warn(`Schema with $id ${schemaId} not found. Returning empty object. Registered schemas: ${registered}`);
            // return undefined;
        }
        return this.schemas.get(schemaId);
    }

    public async getPattern(patternId: string): Promise<object> {
        return await this.getSchema(patternId);
    }

    public storeDocument(documentId: string, documentType: CalmDocumentType, document: object) {
        this.schemas.set(documentId, document);
        this.schemaTypes.set(documentId, documentType);
    }
}