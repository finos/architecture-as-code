import type { CalmDocumentType } from '@finos/calm-models/types';
import type { SchemaDirectory } from '../schema-directory.js';

export interface DocumentLoader {
    initialise(schemaDirectory: SchemaDirectory): Promise<void>;
    loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object>;
    /**
     * Resolve a reference (URL or relative path) to an absolute local file path if possible.
     * Returns undefined if the loader cannot resolve it to a local file.
     */
    resolvePath(reference: string): string | undefined;
}

type ErrorName = 'OPERATION_NOT_IMPLEMENTED' | 'UNKNOWN' | 'AUTHENTICATION_FAILED';

export class DocumentLoadError extends Error {
    name: ErrorName;
    message: string;
    cause?: Error;
    /**
     * Whether a multi-strategy loader should fall through to the next loader on this error.
     * `true` (default) means "this reference isn't mine" — try the next loader.
     * `false` means "I recognised this reference and tried to load it, but it failed" — the
     * error is fatal and should be surfaced to the user instead of being masked.
     */
    recoverable: boolean;

    constructor({
        name,
        message,
        cause,
        recoverable = true
    }: {
        name: ErrorName;
        message: string;
        cause?: Error;
        recoverable?: boolean;
    }) {
        super();
        this.name = name;
        this.message = message;
        this.cause = cause;
        this.recoverable = recoverable;
    }
}
