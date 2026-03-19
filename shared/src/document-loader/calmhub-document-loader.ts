import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader, CALM_HUB_PROTO } from './document-loader';
import { initLogger, Logger } from '../logger';

export class CalmHubDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private readonly logger: Logger;

    constructor(private calmHubUrl: string, debug: boolean, axiosInstance?: Axios) {
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
            throw new Error(`CalmHubDocumentLoader only loads documents with protocol '${CALM_HUB_PROTO}'. (Requested: ${protocol})`);
        }
        // The URL constructor normalizes '..' segments, so url.pathname is already resolved.
        // Reject if the original input contained traversal sequences before normalization,
        // including percent-encoded variants (%2e%2e, %2e., .%2e).
        if (documentId.includes('/..') || /(%2e(\.|%2e)|\.%2e)/i.test(documentId)) {
            throw new Error(`CalmHubDocumentLoader rejected path containing directory traversal in: ${documentId}`);
        }
        // Reconstruct a safe path from validated segments to prevent SSRF.
        // Decode first since URL.pathname is already percent-encoded, then re-encode to normalize.
        const segments = url.pathname.split('/').filter(s => s.length > 0);
        const decodedSegments = segments.map(s => {
            try {
                return decodeURIComponent(s);
            } catch {
                throw new Error(`CalmHubDocumentLoader rejected invalid percent-encoding in path segment: ${s}`);
            }
        });
        // Reject traversal in decoded segments (catches percent-encoded variants like %2e%2e)
        if (decodedSegments.some(s => s === '..' || s === '.')) {
            throw new Error(`CalmHubDocumentLoader rejected path containing directory traversal in: ${documentId}`);
        }
        const safePath = '/' + decodedSegments.map(s => encodeURIComponent(s)).join('/');

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${safePath}`);

        // TODO gracefully handle 404s and other errors
        const response = await this.ax.get(safePath);
        const document = response.data;
        this.logger.debug('Successfully loaded document from CALMHub with id ' + documentId);
        return document;
    }

    /**
     * Only local files via a mapping file are currently supported.
     */
    resolvePath(_reference: string): string | undefined {
        return undefined;
    }
}