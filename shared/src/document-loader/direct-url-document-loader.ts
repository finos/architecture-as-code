import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

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
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Unsupported URL protocol '${parsedUrl.protocol}' in document URL. Only HTTP and HTTPS are allowed.`,
                });
            }
            if (isPrivateHost(parsedUrl.hostname)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: 'Requests to private or internal network addresses are not allowed.',
                });
            }
            const safeUrl = parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname + parsedUrl.search;
            const response = await this.ax.get(safeUrl);
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

const PRIVATE_HOST_PATTERN = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|\[::1\]|\[fe80:.*\]|\[fc.*\]|\[fd.*\])$/i;

function isPrivateHost(hostname: string): boolean {
    return PRIVATE_HOST_PATTERN.test(hostname);
}
