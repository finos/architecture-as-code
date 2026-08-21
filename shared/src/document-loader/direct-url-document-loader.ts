import axios, { Axios } from 'axios';
import { isIP } from 'net';
import { SchemaDirectory } from '../schema-directory';
import { DocumentLoader, DocumentLoadError, assertJsonObject } from './document-loader';
import { Logger, initLogger } from '../logger';
import { DirectUrlAuthPlugin } from '../auth/direct-url-auth-plugin';
import type { CalmDocumentType } from '@finos/calm-models/types';

const DEFAULT_ALLOWED_REMOTE_HOSTS = ['calm.finos.org'];
const REDACTED_HEADER_VALUE = '[REDACTED]';
const SENSITIVE_HEADER_NAMES = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'proxy-authorization',
    'x-api-key',
    'x-auth-token',
]);

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

// Mirrors CalmHubDocumentLoader.SAFE_PATH_PATTERN: a strict character allowlist for the request
// path, checked in addition to (not instead of) the host allowlist below.
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_.-]+$/;

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

function toRequestPath(parsedUrl: URL): string {
    const normalizedPath = parsedUrl.pathname.replace(/^\/+/, '');
    return `/${normalizedPath}`;
}

function normalizeHeaderValue(value: unknown): string | number | boolean | null | undefined | Array<string | number | boolean | null | undefined> {
    if (Array.isArray(value)) {
        return value.map(item => normalizeHeaderValue(item) as string | number | boolean | null | undefined);
    }
    if (
        value === null
        || value === undefined
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
    ) {
        return value;
    }
    return JSON.stringify(value);
}

function redactHeaders(headers: unknown): Record<string, ReturnType<typeof normalizeHeaderValue> | typeof REDACTED_HEADER_VALUE> {
    const candidate = typeof headers === 'object' && headers !== null && 'toJSON' in headers && typeof headers.toJSON === 'function'
        ? headers.toJSON()
        : headers;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(candidate).map(([key, value]) => [
            key,
            SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? REDACTED_HEADER_VALUE : normalizeHeaderValue(value),
        ])
    );
}

function resolveLoggedUrl(baseURL: unknown, url: unknown): string | undefined {
    const base = typeof baseURL === 'string' ? baseURL : undefined;
    const path = typeof url === 'string' ? url : undefined;
    if (base && path) {
        try {
            return new URL(path, base).toString();
        } catch {
            return `${base}${path}`;
        }
    }
    return base ?? path;
}

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;
    private readonly allowedRemoteHosts: Set<string>;
    private readonly directUrlAuthPlugin?: DirectUrlAuthPlugin;

    constructor(
        debug: boolean,
        axiosInstance?: Axios,
        allowedRemoteHosts: readonly string[] = DEFAULT_ALLOWED_REMOTE_HOSTS,
        directUrlAuthPlugin?: DirectUrlAuthPlugin
    ) {
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
        this.directUrlAuthPlugin = directUrlAuthPlugin;
        if (debug) {
            this.addAxiosDebug();
        }
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            this.logger.debug(`Starting Request: ${JSON.stringify({
                method: request.method,
                url: resolveLoggedUrl(request.baseURL, request.url),
                baseURL: request.baseURL,
                path: request.url,
                timeout: request.timeout,
                maxRedirects: request.maxRedirects,
                allowAbsoluteUrls: request.allowAbsoluteUrls,
                headers: redactHeaders(request.headers),
            }, null, 2)}`);
            return request;
        });

        this.ax.interceptors.response.use(response => {
            this.logger.debug(`Response: ${JSON.stringify({
                status: response.status,
                statusText: response.statusText,
                url: resolveLoggedUrl(response.config?.baseURL, response.config?.url),
            }, null, 2)}`);
            return response;
        });
    }

    async initialise(_: SchemaDirectory): Promise<void> {
        // No-op, similar to CalmHubDocumentLoader
        return;
    }

    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(documentId);
        } catch {
            // Not a parseable absolute URL — recoverable, let other loaders try.
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Not a valid absolute URL: ${documentId}`,
            });
        }

        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            // Not an HTTP(S) reference — recoverable, let other loaders try.
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Unsupported URL protocol '${parsedUrl.protocol}' in document URL. Only HTTP and HTTPS are allowed.`,
            });
        }

        // From here the reference is ours (an HTTP(S) URL): any failure is fatal and must not fall
        // through to another loader (which would mask the real reason with an unrelated error).
        try {
            if (isPrivateHost(parsedUrl.hostname)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Requests to private or internal network addresses are not allowed: ${parsedUrl.hostname}`,
                    recoverable: false
                });
            }
            const normalizedHost = normalizeHost(parsedUrl.hostname);
            if (!this.allowedRemoteHosts.has(normalizedHost)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Direct URL loading is restricted to approved hosts. Host '${parsedUrl.hostname}' is not allowlisted.\n\n`
                        + 'To allow this host, run:\n\n'
                        + `  calm init-config --allowed-remote-hosts ${parsedUrl.hostname}\n\n`
                        + 'Only add hosts you trust.',
                    recoverable: false
                });
            }
            if (parsedUrl.username || parsedUrl.password) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: 'Credentials in URL are not allowed.',
                    recoverable: false
                });
            }
            // The URL constructor normalizes '..' segments, so parsedUrl.pathname is already
            // resolved. Reject if the original input contained traversal sequences before
            // normalization, rather than silently trusting the normalized result.
            if (documentId.includes('/..')) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Direct URL loading rejected a path containing directory traversal: ${documentId}`,
                    recoverable: false
                });
            }
            const requestPath = toRequestPath(parsedUrl);
            if (!SAFE_PATH_PATTERN.test(requestPath)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Direct URL loading rejected a path with disallowed characters: ${requestPath}`,
                    recoverable: false
                });
            }
            if (parsedUrl.search) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Direct URL loading does not support a query string: ${documentId}`,
                    recoverable: false
                });
            }
            const baseURL = `${parsedUrl.protocol}//${normalizedHost}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`;
            let authHeaders: Record<string, string> | undefined;
            if (this.directUrlAuthPlugin) {
                try {
                    authHeaders = await this.directUrlAuthPlugin.getAuthHeaders(`${baseURL}${requestPath}`, undefined);
                } catch (error) {
                    throw new DocumentLoadError({
                        name: 'AUTHENTICATION_FAILED',
                        message: `Direct URL authentication failed for ${documentId}. Check direct URL auth configuration and remote credentials.`,
                        cause: error instanceof Error ? error : undefined,
                        recoverable: false
                    });
                }
            }
            const response = await this.ax.get(requestPath, {
                baseURL,
                headers: authHeaders,
                maxRedirects: 0,
                allowAbsoluteUrls: false
            });
            assertJsonObject(response.data, documentId);
            return response.data;
        } catch (error) {
            if (error instanceof DocumentLoadError) {
                throw error;
            }
            if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
                throw new DocumentLoadError({
                    name: 'AUTHENTICATION_FAILED',
                    message: `Direct URL request was not authorized for ${documentId} (HTTP ${error.response.status}). Check direct URL auth configuration and remote credentials.`,
                    cause: error,
                    recoverable: false
                });
            }
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load document from URL: ${documentId}`,
                cause: error instanceof Error ? error : undefined,
                recoverable: false
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
