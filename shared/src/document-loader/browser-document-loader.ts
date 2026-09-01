import type { AuthPlugin } from '../auth/auth-plugin.js';
import type { DocumentLoader } from './document-loader.js';
import { InMemoryDocumentLoader } from './in-memory-document-loader.js';
import { CalmHubDocumentLoader } from './calmhub-document-loader.js';
import { DirectUrlDocumentLoader } from './direct-url-document-loader.js';
import { MultiStrategyDocumentLoader } from './multi-strategy-document-loader.js';

export interface BrowserDocumentLoaderOptions {
    /** documentId -> document. Entries with a string `$id` are registered as schemas. */
    documents: Record<string, object>;
    calmHubUrl?: string;
    authPlugin?: AuthPlugin;
    allowedRemoteHosts?: string[];
    /** Set false to disable direct HTTP(S) loading entirely. Default true. */
    allowRemote?: boolean;
    debug?: boolean;
}

/**
 * Browser counterpart of `buildDocumentLoader`: no filesystem strategies, no `process.cwd()`.
 * Order of precedence: in-memory documents, then CALM Hub (if configured), then direct URLs.
 */
export function buildBrowserDocumentLoader(opts: BrowserDocumentLoaderOptions): DocumentLoader {
    const debug = opts.debug ?? false;
    const loaders: DocumentLoader[] = [new InMemoryDocumentLoader(opts.documents, debug)];
    if (opts.calmHubUrl) {
        loaders.push(new CalmHubDocumentLoader(opts.calmHubUrl, debug, opts.authPlugin));
    }
    if (opts.allowRemote !== false) {
        loaders.push(new DirectUrlDocumentLoader(debug, undefined, opts.allowedRemoteHosts));
    }
    return new MultiStrategyDocumentLoader(loaders, debug);
}
