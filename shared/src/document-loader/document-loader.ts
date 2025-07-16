import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { SchemaDirectory } from '../schema-directory';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { FileSystemDocumentLoader } from './file-system-document-loader';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader';

export type CalmDocumentType = 'architecture' | 'pattern' | 'schema';

export interface DocumentLoader {
    initialise(schemaDirectory: SchemaDirectory): Promise<void>;
    loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object>;
}

export type DocumentLoaderOptions = {
    calmHubUrl?: string;
    schemaDirectoryPath?: string;
    debug?: boolean;
};

export function buildDocumentLoader(docLoaderOpts: DocumentLoaderOptions): DocumentLoader {
    const loaders = [];
    const debug = docLoaderOpts.debug ?? false;

    if (docLoaderOpts.calmHubUrl) {
        loaders.push(new CalmHubDocumentLoader(docLoaderOpts.calmHubUrl, debug));
    }

    // Always configure FileSystemDocumentLoader with CALM_META_SCHEMA_DIRECTORY
    const directoryPaths = [CALM_META_SCHEMA_DIRECTORY];
    if (docLoaderOpts.schemaDirectoryPath) {
        directoryPaths.push(docLoaderOpts.schemaDirectoryPath);
    }
    loaders.push(new FileSystemDocumentLoader(directoryPaths, debug));

    loaders.push(new DirectUrlDocumentLoader(debug));

    return new MultiStrategyDocumentLoader(loaders, debug);
}

type ErrorName = 'OPERATION_NOT_IMPLEMENTED' | 'UNKNOWN';

export class DocumentLoadError extends Error {
    name: ErrorName;
    message: string;
    cause: Error;

    constructor({
        name,
        message,
        cause
    }: {
        name: ErrorName;
        message: string;
        cause?: Error;
    }) {
        super();
        this.name = name;
        this.message = message;
        this.cause = cause;
    }
}