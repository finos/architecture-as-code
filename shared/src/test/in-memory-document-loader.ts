import { DocumentLoader, CalmDocumentType, DocumentLoadError } from '../document-loader/document-loader.js';
import { SchemaDirectory } from '../schema-directory.js';

/**
 * A minimal in-memory {@link DocumentLoader} for unit tests. Documents are served from a
 * simple map; unknown references raise a recoverable {@link DocumentLoadError} so that
 * `SchemaDirectory.getSchema` resolves them to `undefined` (mirroring "not found").
 *
 * An optional `fallback` loader can be supplied so that references not present in the map
 * (e.g. real CALM meta-schemas loaded from disk) are delegated to it. This lets integration
 * tests combine in-memory architecture documents with on-disk meta schemas.
 */
export class InMemoryDocumentLoader implements DocumentLoader {
    constructor(
        private readonly docs: Record<string, object>,
        private readonly fallback?: DocumentLoader
    ) {}

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        if (this.fallback) {
            await this.fallback.initialise(schemaDirectory);
        }
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        if (documentId in this.docs) {
            return this.docs[documentId];
        }
        if (this.fallback) {
            return this.fallback.loadMissingDocument(documentId, type);
        }
        throw new DocumentLoadError({
            name: 'OPERATION_NOT_IMPLEMENTED',
            message: `Document not found: ${documentId}`
        });
    }

    resolvePath(reference: string): string | undefined {
        return this.fallback?.resolvePath(reference);
    }
}
