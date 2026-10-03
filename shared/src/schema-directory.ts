import pointer from 'json-pointer';
import { mergeSchemas, updateStringValuesRecursively } from './util.js';
import { initLogger, Logger } from './logger.js';
import { DocumentLoader, DocumentLoadError } from './document-loader/document-loader.js';
import type { CalmDocumentType } from '@finos/calm-models/types';

/**
 * Stores a directory of schemas and resolves references against that directory.
 * Can merge objects recursively and will handle circular references.
 */
export class SchemaDirectory {
    private readonly schemas: Map<string, object> = new Map<string, object>();
    private readonly schemaTypes: Map<string, CalmDocumentType> = new Map<string, CalmDocumentType>();
    private readonly logger: Logger;
    private readonly debug: boolean;
    private readonly PATTERN_CURRENTLY_VALIDATING = 'patternCurrentlyValidating';
    private documentLoader: DocumentLoader;

    /**
     * Initialise the SchemaDirectory. Does not load the schemas until loadSchemas is called.
     * @param documentLoader The document loader to use for loading documents.
     * @param debug Whether to log at debug level.
     */
    constructor(documentLoader: DocumentLoader, debug: boolean = false) {
        this.debug = debug;
        this.logger = initLogger(debug, 'schema-directory');
        this.documentLoader = documentLoader;
    }

    public loadCurrentPatternAsSchema(pattern: object) {
        this.logger.debug('Loading current pattern as a schema.');
        this.schemas.set(this.PATTERN_CURRENTLY_VALIDATING, pattern);
        this.schemaTypes.set(this.PATTERN_CURRENTLY_VALIDATING, 'pattern');
    }

    /**
     * Initialise the SchemaDirectory. If the DocumentLoader implementation loads documents on startup, they will be loaded here.
     */
    public async loadSchemas(): Promise<void> {
        await this.documentLoader.initialise(this);
    }

    private async lookupDefinition(schemaId: string, ref: string | undefined): Promise<object> {
        const schema = await this.getSchema(schemaId);
        if (!schema) {
            this.logger.warn(`Schema with $id ${schemaId} not found. Returning placeholder with warning message.`);
            return this.getMissingSchemaPlaceholder(ref || schemaId);
        }
        // If no ref (or empty ref), return the whole schema
        if (!ref || ref === '') {
            return schema;
        }
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
            // Unreachable in practice: lookupDefinition returns a placeholder object
            // (getMissingSchemaPlaceholder) rather than a falsy value when a schema
            // cannot be resolved. Kept as a defensive guard.
            throw Error('schema missing!');
        }
        const definitionRef = (definition as { $ref?: string })['$ref'];
        if (!definitionRef) {
            this.logger.debug('Reached a definition with no ref, terminating recursive lookup.');
            return this.qualifyLocalReferences(definition, newSchemaId);
        }
        const newRef: string = definitionRef;
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
    public async getSchema(schemaId: string): Promise<object | undefined> {
        return this.getDocument(schemaId, 'schema');
    }

    /**
     * Return the document with the given id from the directory, loading it via the
     * DocumentLoader if it has not already been loaded. Unlike {@link getSchema}, this
     * accepts an explicit document type, so documents that are not JSON schemas (such as
     * a control's config document, which has no `$id`) can be loaded without being
     * rejected for lacking one.
     * @param documentId The id (path or URL) of the document to load.
     * @param type The CALM document type to load it as.
     * @returns The document as an object, or undefined if it could not be loaded.
     */
    public async getDocument(documentId: string, type: CalmDocumentType): Promise<object | undefined> {
        if (!this.schemas.has(documentId)) {
            try {
                if (/^https?:\/\/json-schema\.org/.test(documentId)) {
                    throw new Error(`Attempted to load standard JSON Schema with ID ${documentId}. This is not supported.`);
                }

                const document = await this.documentLoader.loadMissingDocument(documentId, type);
                this.storeDocument(documentId, type, document);

                return document;
            }
            catch (err) {
                if (err instanceof DocumentLoadError) {
                    if (err.name === 'OPERATION_NOT_IMPLEMENTED') {
                        const registered = this.getLoadedSchemas();
                        this.logger.warn(`Document with id ${documentId} not found. Returning undefined. Registered documents: ${registered}`);
                        return undefined;
                    }
                }
                throw err;
            }
        }
        return this.schemas.get(documentId);
    }

    public async getPattern(patternId: string): Promise<object | undefined> {
        return await this.getSchema(patternId);
    }

    public storeDocument(documentId: string, documentType: CalmDocumentType, document: object) {
        this.logger.debug(`Storing document with ID ${documentId} of type ${documentType}.`);
        this.schemas.set(documentId, document);
        this.schemaTypes.set(documentId, documentType);
    }

    /**
     * Load a CALM document (e.g. an architecture) by reference via the DocumentLoader.
     * Unlike {@link getSchema}, this does not cache the result in the schema map and
     * accepts an explicit document type. Used to fetch raw sub-architecture documents
     * for recursive validation.
     */
    public async loadDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        return this.documentLoader.loadMissingDocument(documentId, type);
    }

    /**
     * Return a new SchemaDirectory backed by the same DocumentLoader, pre-seeded with a
     * copy of this directory's already-loaded schemas.
     *
     * Isolation prevents AJV schema-ID collisions between a parent architecture and a
     * sub-architecture compilation, while reusing the warm cache means the base CALM
     * schemas are not re-fetched for every sub-architecture. The pattern-currently-
     * validating entry is intentionally not copied so the fork can load its own pattern.
     */
    public fork(): SchemaDirectory {
        const forked = new SchemaDirectory(this.documentLoader, this.debug);
        for (const [id, doc] of this.schemas) {
            if (id === this.PATTERN_CURRENTLY_VALIDATING) {
                continue;
            }
            forked.schemas.set(id, doc);
            const type = this.schemaTypes.get(id);
            if (type) {
                forked.schemaTypes.set(id, type);
            }
        }
        return forked;
    }
}