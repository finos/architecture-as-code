import axios, { Axios } from 'axios';
import { isIP } from 'net';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

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

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;

    constructor(debug: boolean, axiosInstance?: Axios) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
