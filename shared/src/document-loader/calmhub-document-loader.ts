import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader, CALM_HUB_PROTO, assertJsonObject, DocumentLoadError } from './document-loader';
import { initLogger, Logger } from '../logger';
import { AuthPlugin } from '../auth/auth-plugin';

export class CalmHubDocumentLoader implements DocumentLoader {
    private static readonly SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_\-.]+(\.json)?$/;
    private readonly ax: Axios;
    private readonly logger: Logger;
    private readonly authPlugin?: AuthPlugin;

    constructor(private calmHubUrl: string, debug: boolean, authPlugin?: AuthPlugin, axiosInstance?: Axios) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                baseURL: calmHubUrl,
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        this.authPlugin = authPlugin;
        
        if (this.authPlugin) {
            this.ax.interceptors.request.use(async (config) => {
                const fullUrl = (config.baseURL || '') + (config.url || '');
                const authHeaders = await this.authPlugin!.getAuthHeaders(fullUrl, config.data);
                Object.assign(config.headers, authHeaders);
                return config;
            });
        }

        // TODO this is far, far too verbose for -v - we really need a -vvv option like cURL
        // if (debug) {
        //     this.addAxiosDebug();
        // }

        this.logger = initLogger(debug, 'calmhub-document-loader');
        this.logger.info('Configuring CALMHub document loader with base URL: ' + calmHubUrl);
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
        return;
    }

    async loadMissingDocument(documentId: string, _: CalmDocumentType): Promise<object> {
        const url = new URL(documentId);
        const protocol = url.protocol;
        if (protocol !== CALM_HUB_PROTO) {
            // Not a calm: reference — recoverable, let other loaders try.
            throw new Error(`CalmHubDocumentLoader only loads documents with protocol '${CALM_HUB_PROTO}'. (Requested: ${protocol})`);
        }

        // From here the reference is ours: any failure is fatal and must not fall through to
        // another loader (which would mask the real reason with an unrelated error).

        // The URL constructor normalizes '..' segments, so url.pathname is already resolved.
        // Reject if the original input contained traversal sequences before normalization.
        if (documentId.includes('/..')) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `CalmHubDocumentLoader rejected path containing directory traversal in: ${documentId}`,
                recoverable: false
            });
        }
        const path = url.pathname;

        if (!CalmHubDocumentLoader.SAFE_PATH_PATTERN.test(path)) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `CalmHubDocumentLoader rejected path with disallowed characters: ${path}`,
                recoverable: false
            });
        }

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${path}`);

        try {
            const response = await this.ax.get(path);
            const document = response.data;
            assertJsonObject(document, documentId);
            this.logger.debug('Successfully loaded document from CALMHub with id ' + documentId);
            return document;
        } catch (err) {
            if (err instanceof DocumentLoadError) {
                throw err;
            }
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load document from CALMHub: ${documentId}`,
                cause: err instanceof Error ? err : undefined,
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