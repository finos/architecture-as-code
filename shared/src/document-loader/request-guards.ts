import { DocumentLoadError } from './document-loader.js';

const SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_.-]+$/;

/**
 * The URL parser resolves '..' segments before the loader sees `url.pathname`, so traversal must be
 * detected on the raw reference. Apply the same rewrites the parser does first: it strips tabs and
 * newlines, treats '\' as '/' in http(s) URLs, and reads '%2e' as '.' in a dot segment.
 */
export function assertNoTraversal(documentId: string, loaderName: string): void {
    const parserView = documentId
        .replace(/[\t\n\r]/g, '')
        .replace(/\\/g, '/')
        .replace(/%2e/gi, '.');
    if (parserView.includes('/..')) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `${loaderName} rejected a path containing directory traversal: ${documentId}`,
            recoverable: false
        });
    }
}

/** Strict character allowlist for the request path, checked in addition to each loader's host checks. */
export function assertSafeRequestPath(path: string, loaderName: string): void {
    if (!SAFE_PATH_PATTERN.test(path)) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `${loaderName} rejected a path with disallowed characters: ${path}`,
            recoverable: false
        });
    }
}
