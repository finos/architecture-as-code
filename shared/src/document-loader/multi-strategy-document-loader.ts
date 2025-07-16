import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';

export class MultiStrategyDocumentLoader implements DocumentLoader {
    private readonly loaders: DocumentLoader[];

    constructor(loaders: DocumentLoader[]) {
        if (!loaders || loaders.length === 0) {
            throw new Error('MultiStrategyDocumentLoader requires at least one DocumentLoader');
        }
        this.loaders = loaders;
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        // Initialise all loaders
        await Promise.all(this.loaders.map(loader => loader.initialise(schemaDirectory)));
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        const errors: Error[] = [];
        for (const loader of this.loaders) {
            try {
                return await loader.loadMissingDocument(documentId, type);
            } catch (err) {
                errors.push(err instanceof Error ? err : new Error(String(err)));
            }
        }
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `All document loaders failed to load document: ${documentId}`,
            cause: errors[errors.length - 1]
        });
    }
}
