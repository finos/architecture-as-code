import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { SchemaDirectory } from '../schema-directory';
import { CalmHubDocumentLoader } from './calmhub-document-loader';
import { FileSystemDocumentLoader } from './file-system-document-loader';
import { DirectUrlDocumentLoader } from './direct-url-document-loader';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader';
import { MappedDocumentLoader } from './mapped-document-loader';
import { WorkspaceDocumentLoader } from './workspace-document-loader';
import { AuthPlugin } from '..';

export type CalmDocumentType = 'architecture' | 'pattern' | 'schema' | 'timeline' | 'interface' | 'flow' | 'adr' | 'control';
export const CALM_DOCUMENT_TYPES_LIST: CalmDocumentType[] = ['pattern', 'architecture', 'interface', 'flow', 'control', 'schema', 'timeline', 'adr'];

export function isValidCalmDocumentType(input: string): input is CalmDocumentType {
    return (CALM_DOCUMENT_TYPES_LIST as string[]).includes(input);
}

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

export function buildDocumentLoader(docLoaderOpts: DocumentLoaderOptions): DocumentLoader {
    const loaders = [];
    const debug = docLoaderOpts.debug ?? false;

    // Workspace bundle takes top priority: local working copies override CalmHub and every
    // other source, for any reference form (bare id, $id, versioned path, or full URL).
    if (docLoaderOpts.workspaceBundlePath) {
        loaders.push(new WorkspaceDocumentLoader(docLoaderOpts.workspaceBundlePath, debug));
    }

    // Add MappedDocumentLoader FIRST if mapping or basePath provided
    // This ensures URL mappings are resolved before other loaders.
    // Note: Relative paths are handled by FileSystemDocumentLoader later in the chain.
    if ((docLoaderOpts.urlToLocalMap && docLoaderOpts.urlToLocalMap.size > 0) || docLoaderOpts.basePath) {
        loaders.push(new MappedDocumentLoader(
            docLoaderOpts.urlToLocalMap ?? new Map(),
            docLoaderOpts.basePath ?? process.cwd(),
            debug
        ));
    }

    if (docLoaderOpts.calmHubUrl) {
        loaders.push(new CalmHubDocumentLoader(docLoaderOpts.calmHubUrl, debug, docLoaderOpts.authPlugin));
    }

    // Always configure FileSystemDocumentLoader with CALM_META_SCHEMA_DIRECTORY
    const directoryPaths = [CALM_META_SCHEMA_DIRECTORY];
    if (docLoaderOpts.schemaDirectoryPath) {
        directoryPaths.push(docLoaderOpts.schemaDirectoryPath);
    }
    loaders.push(new FileSystemDocumentLoader(
        directoryPaths,
        debug,
        docLoaderOpts.basePath ?? process.cwd()
    ));

    loaders.push(new DirectUrlDocumentLoader(debug, undefined, docLoaderOpts.allowedRemoteHosts));

    return new MultiStrategyDocumentLoader(loaders, debug);
}

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
