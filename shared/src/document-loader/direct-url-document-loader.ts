import axios, { Axios } from 'axios';
import { isIP } from 'net';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

const DEFAULT_ALLOWED_REMOTE_HOSTS = ['calm.finos.org'];

const PRIVATE_IPV4_PATTERNS = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
];

const PRIVATE_IPV6_PATTERNS = [
    /^::1$/,
    /^fc/i,
    /^fd/i,
    /^fe80:/i,
];

function isPrivateHost(hostname: string): boolean {
    if (/^localhost$/i.test(hostname)) return true;
    // URL.hostname wraps IPv6 in brackets; strip them for isIP/pattern checks
    const bare = hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
    const ipVersion = isIP(bare);
    if (ipVersion === 4) return PRIVATE_IPV4_PATTERNS.some(p => p.test(bare));
    if (ipVersion === 6) return PRIVATE_IPV6_PATTERNS.some(p => p.test(bare));
    return false;
}

function normalizeHost(hostname: string): string {
    const bare = hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
    return bare.toLowerCase();
}

/**
 * Validate and normalise the request path to prevent SSRF via path traversal or
 * access to unintended endpoints on the allowed host.
 *
 * This implementation:
 *  - strips leading slashes,
 *  - rejects empty paths,
 *  - rejects ".", ".." and empty segments,
 *  - ensures the path starts with an expected prefix (e.g. "schemas/").
 */
function toSafeRequestPath(parsedUrl: URL): string {
    const rawPath = parsedUrl.pathname || '/';
    const withoutLeadingSlashes = rawPath.replace(/^\/+/, '');

    if (!withoutLeadingSlashes) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: 'Empty document path is not allowed in direct URL loader.',
        });
    }

    const segments = withoutLeadingSlashes.split('/');
    for (const segment of segments) {
        if (!segment || segment === '.' || segment === '..') {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: 'Path traversal or invalid path segment detected in document URL.',
            });
        }
    }

    // Constrain schemas to a well-known prefix on the remote host.
    // Adjust "schemas/" if the remote host uses a different directory for documents.
    const safePrefix = 'schemas/';
    const normalisedPath = segments.join('/');
    if (!normalisedPath.startsWith(safePrefix)) {
        throw new DocumentLoadError({
            name: 'UNKNOWN',
            message: `Direct URL loading is restricted to paths under "/${safePrefix}".`,
        });
    }

    return `/${normalisedPath}${parsedUrl.search}`;
}

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;
    private readonly allowedRemoteHosts: Set<string>;

    constructor(debug: boolean, axiosInstance?: Axios, allowedRemoteHosts: readonly string[] = DEFAULT_ALLOWED_REMOTE_HOSTS) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        this.logger = initLogger(debug, 'direct-url-document-loader');
        this.allowedRemoteHosts = new Set(allowedRemoteHosts.map(host => normalizeHost(host)));
        if (debug) {
            this.addAxiosDebug();
        }
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            console.log('Starting Request', JSON.stringify(request, null, 2));
            return request;
        });

        this.ax.interceptors.response.use(response => {
            console.log('Response:', response);
            return response;
        });
    }

    async initialise(_: SchemaDirectory): Promise<void> {
        // No-op, similar to CalmHubDocumentLoader
        return;
    }

    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        try {
            const parsedUrl = new URL(documentId);
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(parsedUrl.protocol)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Unsupported URL protocol '${parsedUrl.protocol}' in document URL. Only HTTP and HTTPS are allowed.`,
                });
            }
            if (isPrivateHost(parsedUrl.hostname)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Requests to private or internal network addresses are not allowed: ${parsedUrl.hostname}`,
                });
            }
            const normalizedHost = normalizeHost(parsedUrl.hostname);
            if (!this.allowedRemoteHosts.has(normalizedHost)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Direct URL loading is restricted to approved hosts. Host '${parsedUrl.hostname}' is not allowlisted.`,
                });
            }
            if (parsedUrl.username || parsedUrl.password) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: 'Credentials in URL are not allowed.',
                });
            }
            const requestPath = toSafeRequestPath(parsedUrl);
            const baseURL = `${parsedUrl.protocol}//${normalizedHost}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`;
            const response = await this.ax.get(requestPath, {
                baseURL,
                maxRedirects: 0,
                allowAbsoluteUrls: false
            });
            return response.data;
        } catch (error) {
            if (error instanceof DocumentLoadError) {
                throw error;
            }
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load document from URL: ${documentId}`,
                cause: error instanceof Error ? error : undefined
            });
        }
    }

    /**
     * Only local files via a mapping file are currently supported.
     */
    resolvePath(_reference: string): string | undefined {
        return undefined;
    }
}
