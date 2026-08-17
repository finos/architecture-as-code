import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { DocumentLoader, assertJsonObject, DocumentLoadError, CALM_HUB_PROTOS } from './document-loader';
import { initLogger, Logger } from '../logger';
import { AuthPlugin } from '../auth/auth-plugin';
import type { CalmDocumentType } from '@finos/calm-models/types';

export class CalmHubDocumentLoader implements DocumentLoader {
    private static readonly SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_\-.]+(\.json)?$/;
    private readonly ax: Axios;
    private readonly logger: Logger;
    private readonly authPlugin?: AuthPlugin;
    // The origin (protocol + host + port) that an http(s) reference must match to be considered
    // "ours". calmHubUrl must be a parseable absolute URL — see the constructor validation below.
    private readonly calmHubOrigin: string;

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
        try {
            this.calmHubOrigin = new URL(calmHubUrl).origin;
        } catch (err) {
            // Fail fast on a bad calmHubUrl, rather than silently rejecting every http(s) ref later.
            const reason = err instanceof Error ? `: ${err.message}` : '';
            throw new Error(
                `Invalid CalmHub URL '${calmHubUrl}': must be an absolute URL, e.g. 'https://calmhub.example.com'${reason}.`
            );
        }

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
        if (!CALM_HUB_PROTOS.some(p => p === protocol)) {
            // Not a protocol we recognise — recoverable, let other loaders try.
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `CalmHubDocumentLoader can only load documents with protocol '${CALM_HUB_PROTOS.join(', ')}'. (Requested: ${protocol})`,
                recoverable: true
            });
        }

        // An http(s) reference is only ours if it actually points at this CalmHub instance.
        // Anything else (e.g. an allowlisted external host meant for DirectUrlDocumentLoader) is
        // recoverable — let other loaders try. calm: references are host-agnostic and always ours.
        if ((protocol === 'http:' || protocol === 'https:') && url.origin !== this.calmHubOrigin) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `CalmHubDocumentLoader only loads http(s) documents from the configured CALMHub origin '${this.calmHubOrigin}'. (Requested: ${url.origin})`,
                recoverable: true
            });
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