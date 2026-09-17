import { SchemaDirectory } from '../schema-directory.js';
import type { CalmReferenceResolver } from './calm-reference-resolver.js';
import type { CalmDocumentType } from '@finos/calm-models/types';

/**
 * A {@link CalmReferenceResolver} that resolves references by loading raw documents through a
 * {@link SchemaDirectory}.
 *
 * This bridges the `SchemaDirectory.loadDocument(id, type)` seam to the plain `canResolve`/`resolve`
 * resolver interface, so validation can share the same resolver abstraction (and the
 * {@link import('./caching-tracking-resolver').CachingTrackingResolver} decorator) as the model
 * dereference path — rather than passing a bespoke loader lambda.
 */
export class SchemaDirectoryReferenceResolver implements CalmReferenceResolver {
    constructor(
        private readonly schemaDirectory: SchemaDirectory | undefined,
        private readonly documentType: CalmDocumentType = 'architecture'
    ) {}

    canResolve(_reference: string): boolean {
        return this.schemaDirectory !== undefined;
    }

    async resolve(reference: string): Promise<unknown> {
        if (!this.schemaDirectory) {
            throw new Error(`Cannot resolve reference '${reference}' without a schema directory`);
        }
        return this.schemaDirectory.loadDocument(reference, this.documentType);
    }
}
