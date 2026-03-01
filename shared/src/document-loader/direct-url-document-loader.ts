import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';

export class DirectUrlDocumentLoader implements DocumentLoader {
    private static readonly ALLOWED_HOSTS: string[] = (process.env.CALM_SCHEMA_ALLOWED_HOSTS ?? '')
        .split(',')
        .map(host => host.trim().toLowerCase())
        .filter(host => host.length > 0);

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

    private isAllowedUrl(urlString: string): boolean {
        let url: URL;
        try {
            url = new URL(urlString);
        } catch {
            return false;
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }

        const hostname = url.hostname.toLowerCase();

        if (DirectUrlDocumentLoader.ALLOWED_HOSTS.length === 0) {
            // If no allow-list is configured, do not allow any remote hosts.
            return false;
        }

        return DirectUrlDocumentLoader.ALLOWED_HOSTS.includes(hostname);
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
        if (!this.isAllowedUrl(documentId)) {
            throw new DocumentLoadError({
                name: 'INVALID_DOCUMENT_URL',
                message: `Refusing to load document from disallowed URL: ${documentId}`
            });
        }

        try {
            const response = await this.ax.get(documentId);
            return response.data;
        } catch (error) {
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
