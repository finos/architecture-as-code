import { DocumentLoadError, type DocumentLoader, type SchemaDirectory } from '@finos/calm-shared/browser';
import type { Line, ShellContext } from '../shell';
import { logLine } from './log';
import { readError } from './unsupported';

export interface ReadFile { reference: string; path: string; content: string; doc: object }

/** Reads a JSON file from the cwd; the error is the message the CLI's file loader reports. */
export function readJsonFile(ctx: ShellContext, reference: string): ReadFile | { error: string } {
    const path = ctx.vfs.resolve(ctx.getCwd(), reference);
    const content = ctx.vfs.read(path);
    if (content === null) {
        return { error: readError(ctx.vfs, path) };
    }
    try {
        return { reference, path, content, doc: JSON.parse(content) as object };
    } catch (error) {
        return { error: `${path} is not valid JSON: ${(error as Error).message}` };
    }
}

export interface MappedFile { url: string; path: string; content: string | null; isDir: boolean }

export interface UrlMapping {
    path: string;
    /** The mapping file and every mapped file, as read; null for one that does not exist. */
    snapshot: Record<string, string | null>;
    /** The CLI's `mapped-document-loader` warnings, printed before anything loads. */
    warnings: Line[];
    files: Map<string, MappedFile>;
}

/** A `$ref` that failed fatally, named as the CLI names its loaders. */
export interface LoadFailure { loader: 'MappedDocumentLoader' | 'DirectUrlDocumentLoader'; url: string; message: string }

function loadMapped(file: MappedFile): object {
    if (file.content === null && !file.isDir) {
        throw new DocumentLoadError({ name: 'UNKNOWN', message: `File not found: ${file.path}`, recoverable: false });
    }
    try {
        if (file.content === null) {
            throw new Error('EISDIR: illegal operation on a directory, read');
        }
        return JSON.parse(file.content) as object;
    } catch (error) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `Failed to load/parse ${file.path}: ${(error as Error).message}`,
            recoverable: false,
        });
    }
}

/** The lab's MappedDocumentLoader (shared/src/document-loader/mapped-document-loader.ts) over the vfs. */
class VfsMappedLoader implements DocumentLoader {
    constructor(private readonly files: Map<string, MappedFile>, private readonly failures: LoadFailure[]) {}

    async initialise(directory: SchemaDirectory): Promise<void> {
        for (const [url, file] of this.files) {
            let document: object;
            try {
                document = loadMapped(file);
            } catch {
                continue;
            }
            directory.storeDocument(url, 'schema', document);
            const id = (document as { $id?: unknown }).$id;
            if (typeof id === 'string' && id !== url) {
                directory.storeDocument(id, 'schema', document);
            }
        }
    }

    async loadMissingDocument(documentId: string): Promise<object> {
        const file = this.files.get(documentId);
        if (!file) {
            throw new DocumentLoadError({ name: 'OPERATION_NOT_IMPLEMENTED', message: `MappedDocumentLoader cannot resolve: ${documentId}` });
        }
        try {
            return loadMapped(file);
        } catch (error) {
            this.failures.push({ loader: 'MappedDocumentLoader', url: documentId, message: (error as Error).message });
            throw error;
        }
    }

    resolvePath(reference: string): string | undefined {
        return this.files.get(reference)?.path;
    }
}

// DirectUrlDocumentLoader's default allowlist (shared/src/document-loader/direct-url-document-loader.ts).
const DEFAULT_ALLOWED_HOST = 'calm.finos.org';

/**
 * Last in line, where the CLI fetches a URL. The lab never fetches: an http(s) URL gives the CLI's
 * message for a host outside its default allowlist, or a lab note for the one host it allows.
 */
class UnfetchedUrlLoader implements DocumentLoader {
    constructor(private readonly failures: LoadFailure[]) {}

    async initialise(): Promise<void> {}

    async loadMissingDocument(documentId: string): Promise<object> {
        let host: string;
        try {
            const url = new URL(documentId);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                throw new Error('not http(s)');
            }
            host = url.hostname;
        } catch {
            throw new DocumentLoadError({ name: 'UNKNOWN', message: `Not a valid absolute URL: ${documentId}` });
        }
        const message = host.toLowerCase() === DEFAULT_ALLOWED_HOST
            ? `The browser lab does not download documents. Map ${documentId} to a workspace file with -u.`
            : `Direct URL loading is restricted to approved hosts. Host '${host}' is not allowlisted.\n\n`
                + 'To allow this host, run:\n\n'
                + `  calm init-config --allowed-remote-hosts ${host}\n\n`
                + 'Only add hosts you trust.';
        this.failures.push({ loader: 'DirectUrlDocumentLoader', url: documentId, message });
        throw new DocumentLoadError({ name: 'UNKNOWN', message, recoverable: false });
    }

    resolvePath(): string | undefined {
        return undefined;
    }
}

export interface RefLoaders { first?: DocumentLoader; last: DocumentLoader; failures: LoadFailure[] }

/** The loaders one command puts around the bundled meta-schemas: `-u` first, the unfetched URLs last. */
export function refLoaders(mapping?: UrlMapping): RefLoaders {
    const failures: LoadFailure[] = [];
    return {
        first: mapping && new VfsMappedLoader(mapping.files, failures),
        last: new UnfetchedUrlLoader(failures),
        failures,
    };
}

/**
 * What the CLI logs for a `$ref` that failed while the pattern compiled: the loader, AJV's
 * `loadSchema`, and (when an architecture is checked against the pattern) the JSON Schema rule.
 */
export function refFailureLines(failures: LoadFailure[], againstArchitecture: boolean): Line[] {
    const seen = new Set<string>();
    return failures.filter(({ url }) => !seen.has(url) && seen.add(url)).flatMap(({ loader, url, message }) => [
        logLine('error', 'multi-strategy-document-loader', `Loader ${loader} failed fatally loading document: ${url}. Enable debug logging for the full loader report.`),
        logLine('error', 'json-schema-validator', `Error fetching schema from schema directory: UNKNOWN: ${message}`),
        ...(againstArchitecture ? [logLine('error', 'calm-validate', `JSON Schema compilation failed: ${message}`)] : []),
    ]).flatMap((text) => text.split('\n').map((line): Line => ({ text: line, kind: 'err' })));
}

/** The CLI's `-u` (cli/src/command-helpers/template.ts getUrlToLocalFileMap): paths resolve against the mapping file's directory. */
export function readUrlMapping(ctx: ShellContext, reference: string): UrlMapping | { error: Line } {
    const path = ctx.vfs.resolve(ctx.getCwd(), reference);
    const content = ctx.vfs.read(path);
    // The CLI prints the error object, stack and all; the first line is the useful part.
    const failure = (error: Error) => ({
        error: { text: `Error reading url to local file mapping file: ${reference} ${error.name}: ${error.message}`, kind: 'err' } as Line,
    });
    if (content === null) {
        return failure(new Error(readError(ctx.vfs, path, reference)));
    }
    let entries: [string, unknown][];
    try {
        entries = Object.entries(JSON.parse(content) as object);
    } catch (error) {
        return failure(error as Error);
    }

    const directory = path.slice(0, path.lastIndexOf('/')) || '/';
    const files = new Map<string, MappedFile>();
    const snapshot: Record<string, string | null> = { [path]: content };
    const warnings: Line[] = [];
    for (const [url, value] of entries) {
        const mappedPath = ctx.vfs.resolve(directory, String(value));
        const file: MappedFile = { url, path: mappedPath, content: ctx.vfs.read(mappedPath), isDir: ctx.vfs.isDir(mappedPath) };
        files.set(url, file);
        // A missing target is recorded too, so creating it later makes the outcome stale.
        snapshot[mappedPath] = file.content;
        if (file.content === null && !file.isDir) {
            warnings.push({ text: logLine('warn', 'mapped-document-loader', `Mapped file does not exist: ${mappedPath} (mapped from ${url})`), kind: 'dim' });
            continue;
        }
        try {
            loadMapped(file);
        } catch (error) {
            warnings.push({ text: logLine('warn', 'mapped-document-loader', `Failed to pre-load ${url}: ${(error as Error).message}`), kind: 'dim' });
        }
    }
    return { path, snapshot, warnings, files };
}
