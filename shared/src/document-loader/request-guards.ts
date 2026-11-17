import { DocumentLoadError } from './document-loader.js';

const SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_.-]+$/;
const DOT_DOT_SEGMENT = /(^|[/:])\.\.($|\/)/;

function trimC0ControlOrSpace(value: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value.charCodeAt(start) <= 0x20) {
        start++;
    }
    while (end > start && value.charCodeAt(end - 1) <= 0x20) {
        end--;
    }
    return value.slice(start, end);
}

/**
 * The URL parser resolves '..' segments before the loader sees `url.pathname`, so traversal must be
 * detected on the raw reference. Apply the same rewrites the parser does first: it trims leading and
 * trailing control characters and spaces, strips tabs and newlines, treats '\' as '/' in http(s)
 * URLs, and reads '%2e' as '.' in a dot segment. The parser does not resolve '..' in the query or
 * fragment, so those are not checked. It keeps a leading '..' in a `calm:` path, which the HTTP
 * client then resolves against the base URL.
 */
export function assertNoTraversal(documentId: string, loaderName: string): void {
    let parserView = trimC0ControlOrSpace(documentId)
        .replace(/[\t\n\r]/g, '')
        .replace(/[?#].*$/s, '');
    if (/^https?:/i.test(parserView)) {
        parserView = parserView.replace(/\\/g, '/');
    }
    parserView = parserView.replace(/%2e/gi, '.');
    if (DOT_DOT_SEGMENT.test(parserView)) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `${loaderName} rejected a path containing directory traversal: ${documentId}`,
            recoverable: false
        });
    }
}

/**
 * Strict allowlist for the request path, checked in addition to each loader's host checks. The path
 * must start with exactly one '/'. The HTTP client adds a relative path to the base URL, where '..' is
 * resolved, and treats a path that starts with '//' as a URL on another host.
 *
 * Callers test this inline, `if (!isSafeRequestPath(path)) throw ...`, on the same variable they pass
 * to the HTTP client. CodeQL (js/request-forgery) does not see a guard inside a function that throws.
 */
export function isSafeRequestPath(path: string): boolean {
    return path.startsWith('/') && !path.startsWith('//') && SAFE_PATH_PATTERN.test(path);
}

export function unsafeRequestPathError(path: string, loaderName: string): DocumentLoadError {
    const reason = !path.startsWith('/') || path.startsWith('//')
        ? 'that does not start with a single \'/\''
        : 'with disallowed characters';
    return new DocumentLoadError({
        name: 'UNKNOWN',
        message: `${loaderName} rejected a path ${reason}: ${path}`,
        recoverable: false
    });
}
