import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { SchemaDirectory } from '../schema-directory';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { FileSystemDocumentLoader } from './file-system-document-loader';

export type CalmDocumentType = 'architecture' | 'pattern' | 'schema';

export interface DocumentLoader {
    initialise(schemaDirectory: SchemaDirectory): Promise<void>;
    loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object>;
}

export type DocumentLoadMode = 'filesystem' | 'calmhub';

type FileSystemLoaderOptions = {
    loadMode: 'filesystem';
    schemaDirectoryPath: string;
}
type CalmHubLoaderOptions = {
    loadMode: 'calmhub';
    calmHubUrl: string;
}
export type DocumentLoaderOptions = FileSystemLoaderOptions | CalmHubLoaderOptions;

export function buildDocumentLoader(docLoaderOpts: DocumentLoaderOptions, debug: boolean): DocumentLoader {
    switch(docLoaderOpts.loadMode) {
    case 'filesystem': {
        const directoryPaths = [CALM_META_SCHEMA_DIRECTORY];
        if (docLoaderOpts.schemaDirectoryPath) {
            directoryPaths.push(docLoaderOpts.schemaDirectoryPath);
        }
        return new FileSystemDocumentLoader(directoryPaths, debug);
    } 
    case 'calmhub': {
        return new CalmHubDocumentLoader(docLoaderOpts.calmHubUrl, debug);
    }
    default:
        throw new Error('Invalid document load mode when constructing DocumentLoader!');
    }
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