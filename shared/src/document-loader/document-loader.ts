import { SchemaDirectory } from "../schema-directory";
import { CalmDocumentType } from "../types";

export interface DocumentLoader {
    initialise(schemaDirectory: SchemaDirectory): Promise<void>;
    loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object>;
}

export type DocumentLoadMode = 'filesystem' | 'calmhub';

export interface DocumentLoaderOptions {
    schemaDirectoryPath?: string;
    calmHubUrl?: string;    
    loadMode: DocumentLoadMode;
}