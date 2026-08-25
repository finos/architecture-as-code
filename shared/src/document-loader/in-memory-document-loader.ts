import type { SchemaDirectory } from '../schema-directory.js';
import { DocumentLoader, DocumentLoadError } from './document-loader.js';
import { initLogger, Logger } from '../logger.js';
import type { CalmDocumentType } from '@finos/calm-models/types';

/**
 * A {@link DocumentLoader} over a caller-supplied map of documentId -> document. Browser
 * consumers mount their virtual filesystem (and the CALM meta-schemas they bundle) through
 * this loader; it is also convenient for tests.
 *
 * Documents whose `$id` is a string are registered as schemas on initialise, so schema lookups
 * behave exactly as they do with {@link FileSystemDocumentLoader} over a schema directory.
 */
export class InMemoryDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;

    constructor(private readonly documents: Record<string, object>, debug: boolean = false) {
        this.logger = initLogger(debug, 'in-memory-document-loader');
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        for (const [key, document] of Object.entries(this.documents)) {
            const id = (document as { $id?: unknown })['$id'];
            if (typeof id !== 'string') {
                this.logger.debug(`Skipping ${key}: no $id, not a schema.`);
                continue;
            }
            schemaDirectory.storeDocument(id, 'schema', document);
            this.logger.debug(`Registered schema ${id} from in-memory document ${key}.`);
        }
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        if (Object.prototype.hasOwnProperty.call(this.documents, documentId)) {
            return this.documents[documentId];
        }
        const message = `Document with id [${documentId}] and type [${type}] is not present in the in-memory document store.`;
        this.logger.debug(message);
        throw new DocumentLoadError({ name: 'OPERATION_NOT_IMPLEMENTED', message });
    }

    resolvePath(_reference: string): string | undefined {
        return undefined;
    }
}
