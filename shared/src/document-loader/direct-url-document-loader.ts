import axios, { Axios } from 'axios';
import { isIP } from 'net';
import { lookup as dnsLookup } from 'dns/promises';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

export type DnsLookupFn = (hostname: string) => Promise<{ address: string; family: number }>;

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

function isPrivateIP(ip: string): boolean {
    const ipVersion = isIP(ip);
    if (ipVersion === 4) return PRIVATE_IPV4_PATTERNS.some(p => p.test(ip));
    if (ipVersion === 6) return PRIVATE_IPV6_PATTERNS.some(p => p.test(ip));
    return false;
}

function isPrivateHost(hostname: string): boolean {
    if (/^localhost$/i.test(hostname)) return true;
    // URL.hostname wraps IPv6 in brackets; strip them for isIP/pattern checks
    const bare = hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname;
    return isPrivateIP(bare);
}

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;
    private readonly dnsResolve: DnsLookupFn;

    constructor(debug: boolean, axiosInstance?: Axios, dnsLookupFn?: DnsLookupFn) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        this.dnsResolve = dnsLookupFn ?? dnsLookup;

        this.logger = initLogger(debug, 'direct-url-document-loader');
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
            // Resolve DNS and validate the resolved IP to prevent DNS rebinding
            // attacks where a hostname passes the string check but resolves to
            // a private/internal IP address
            const bare = parsedUrl.hostname.startsWith('[') && parsedUrl.hostname.endsWith(']')
                ? parsedUrl.hostname.slice(1, -1)
                : parsedUrl.hostname;
            if (isIP(bare) === 0) {
                const resolved = await this.dnsResolve(bare);
                if (isPrivateIP(resolved.address)) {
                    throw new DocumentLoadError({
                        name: 'UNKNOWN',
                        message: `Requests to private or internal network addresses are not allowed: ${bare} resolved to ${resolved.address}`,
                    });
                }
            }
            const targetUrl = parsedUrl.toString();
            const response = await this.ax.get(targetUrl, { maxRedirects: 0 });
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
