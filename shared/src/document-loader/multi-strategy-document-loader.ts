import { initLogger, Logger } from '../logger';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';

export class MultiStrategyDocumentLoader implements DocumentLoader {
    private readonly loaders: DocumentLoader[];
    private logger: Logger;

    constructor(loaders: DocumentLoader[], debug: boolean = false) {
        if (!loaders || loaders.length === 0) {
            throw new Error('MultiStrategyDocumentLoader requires at least one DocumentLoader');
        }
        this.loaders = loaders;
        this.logger = initLogger(debug, 'multi-strategy-document-loader');
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        // Initialise all loaders
        this.logger.debug('Initialising MultiStrategyDocumentLoader with loaders: ' + this.loaders.map(loader => loader.constructor.name).join(', '));
        await Promise.all(this.loaders.map(loader => loader.initialise(schemaDirectory)));
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        this.logger.debug(`Attempting to load missing document: ${documentId} of type ${type}`);
        const errors: Error[] = [];
        for (const loader of this.loaders) {
            try {
                return await loader.loadMissingDocument(documentId, type);
            } catch (err) {
                errors.push(err instanceof Error ? err : new Error(String(err)));
            }
        }
        this.logger.error(`All document loaders failed to load document: ${documentId}. Errors: ${errors.map(e => e.message).join(', ')}`);
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `All document loaders failed to load document: ${documentId}`,
            cause: errors[errors.length - 1]
        });
    }
}
