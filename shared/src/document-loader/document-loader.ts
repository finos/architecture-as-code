import type { SchemaDirectory } from '../schema-directory.js';
import type { AuthPlugin } from '../auth/auth-plugin.js';
import type { CalmDocumentType } from '@finos/calm-models/types';

export const CALM_HUB_PROTOS = ['http:', 'https:', 'calm:'];

export interface DocumentLoader {
    initialise(schemaDirectory: SchemaDirectory): Promise<void>;
    loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object>;
    /**
     * Resolve a reference (URL or relative path) to an absolute local file path if possible.
     * Returns undefined if the loader cannot resolve it to a local file.
     */
    resolvePath(reference: string): string | undefined;
}

export type DocumentLoaderOptions = {
    calmHubUrl?: string;
    authPlugin?: AuthPlugin;
    schemaDirectoryPath?: string;
    urlToLocalMap?: Map<string, string>;
    basePath?: string;
    allowedRemoteHosts?: string[];
    debug?: boolean;
    // If set, a WorkspaceDocumentLoader is added as the highest-priority source, resolving any
    // reference to a document tracked in the workspace bundle at this path to its local copy.
    workspaceBundlePath?: string;
};

export function assertJsonObject(data: unknown, source: string): asserts data is object {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        const kind = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
        // Fatal: the loader successfully fetched this reference, but the payload is invalid.
        // This must surface to the user rather than fall through to another loader.
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `Expected a JSON object from ${source} but received: ${kind}`,
            recoverable: false
        });
    }
}

type ErrorName = 'OPERATION_NOT_IMPLEMENTED' | 'UNKNOWN';

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
