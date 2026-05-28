import { initLogger, Logger } from '../logger';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';


type LoadReport = {
    loaderName: string,
    error?: Error,
}

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
        const errors: LoadReport[] = [];
        for (const loader of this.loaders) {
            try {
                return await loader.loadMissingDocument(documentId, type);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                errors.push({ loaderName: loader.constructor.name, error });

                // A fatal (non-recoverable) error means this loader recognised the reference and
                // genuinely failed to load it. Surface it immediately rather than masking it with a
                // later loader's "this reference isn't mine" error.
                if (err instanceof DocumentLoadError && !err.recoverable) {
                    this.logger.error(`Loader ${loader.constructor.name} failed fatally loading document: ${documentId}. Enable debug logging for the full loader report.`);
                    this.printErrorMessages(errors);
                    throw err;
                }
            }
        }
        this.logger.error(`All document loaders failed to load document: ${documentId}. Enable debug logging for the full loader report.`);
        this.printErrorMessages(errors);
        const lastError = errors[errors.length - 1].error;
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: lastError?.message ?? `Failed to load document: ${documentId}`,
        });
    }

    printErrorMessages(errors: LoadReport[]): void {
        let report = 'Document Loader Report:\n';
        for (const { loaderName, error } of errors) {
            report += `Loader ${loaderName} FAILED with error: ${error?.message}\n`;
        }
        this.logger.debug(report);
    }

    resolvePath(reference: string): string | undefined {
        for (const loader of this.loaders) {
            const resolved = loader.resolvePath(reference);
            if (resolved) {
                return resolved;
            }
        }
        return undefined;
    }
}
