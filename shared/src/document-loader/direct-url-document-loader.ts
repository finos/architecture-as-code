import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;

    private isPrivateOrLocalHost(hostname: string): boolean {
        const lower = hostname.toLowerCase();

        // Block obvious local hostnames
        if (lower === 'localhost' || lower === 'localhost.localdomain') {
            return true;
        }

        // Block IPv6 loopback
        if (lower === '::1') {
            return true;
        }

        // Simple checks for IPv4 private / loopback / link-local ranges
        const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4Match) {
            const [ , aStr, bStr, cStr, dStr ] = ipv4Match;
            const a = parseInt(aStr, 10);
            const b = parseInt(bStr, 10);
            const c = parseInt(cStr, 10);
            const d = parseInt(dStr, 10);

            if ([a, b, c, d].some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
                return true;
            }

            // 127.0.0.0/8 loopback
            if (a === 127) {
                return true;
            }
            // 10.0.0.0/8 private
            if (a === 10) {
                return true;
            }
            // 172.16.0.0/12 private
            if (a === 172 && b >= 16 && b <= 31) {
                return true;
            }
            // 192.168.0.0/16 private
            if (a === 192 && b === 168) {
                return true;
            }
            // 169.254.0.0/16 link-local
            if (a === 169 && b === 254) {
                return true;
            }
        }

        return false;
    }

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

            const hostname = parsedUrl.hostname;
            if (!hostname) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: 'Document URL must include a hostname.',
                });
            }

            if (this.isPrivateOrLocalHost(hostname)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Access to private or local host '${hostname}' is not allowed for document URLs.`,
                });
            }

            const response = await this.ax.get(parsedUrl.toString());
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
