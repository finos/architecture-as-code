import axios, { Axios } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader, CALM_HUB_PROTO } from './document-loader';
import { initLogger, Logger } from '../logger';

// This must be kept in sync with the actual endpoints supported by the CALMHub API,
// as the document loader will reject any paths that do not match one of these patterns.
const CALM_HUB_ALLOWED_PATHS: RegExp[] = [
    // Schema endpoints
    /^\/schemas$/,
    /^\/schemas\/[^/]+\/meta$/,
    /^\/schemas\/[^/]+\/meta\/[^/]+$/,
    // Controls
    /^\/controls\/domains$/,
    // Namespaces
    /^\/namespaces$/,
    // Architectures
    /^\/namespaces\/[^/]+\/architectures$/,
    /^\/namespaces\/[^/]+\/architectures\/[^/]+\/versions$/,
    /^\/namespaces\/[^/]+\/architectures\/[^/]+\/versions\/[^/]+$/,
    // Patterns
    /^\/namespaces\/[^/]+\/patterns$/,
    /^\/namespaces\/[^/]+\/patterns\/[^/]+\/versions$/,
    /^\/namespaces\/[^/]+\/patterns\/[^/]+\/versions\/[^/]+$/,
    // Standards
    /^\/namespaces\/[^/]+\/standards$/,
    /^\/namespaces\/[^/]+\/standards\/[^/]+\/versions$/,
    /^\/namespaces\/[^/]+\/standards\/[^/]+\/versions\/[^/]+$/,
    // ADRs
    /^\/namespaces\/[^/]+\/adrs$/,
    /^\/namespaces\/[^/]+\/adrs\/[^/]+$/,
    /^\/namespaces\/[^/]+\/adrs\/[^/]+\/revisions$/,
    /^\/namespaces\/[^/]+\/adrs\/[^/]+\/revisions\/[^/]+$/,
    // Flows
    /^\/namespaces\/[^/]+\/flows$/,
    /^\/namespaces\/[^/]+\/flows\/[^/]+$/,
    /^\/namespaces\/[^/]+\/flows\/[^/]+\/versions$/,
    /^\/namespaces\/[^/]+\/flows\/[^/]+\/versions\/[^/]+$/,
    // Decorators
    /^\/namespaces\/[^/]+\/decorators$/,
    /^\/namespaces\/[^/]+\/decorators\/values$/,
    /^\/namespaces\/[^/]+\/decorators\/[^/]+$/
];

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
        // Reject if the original input contained traversal sequences before normalization.
        if (documentId.includes('/..')) {
            throw new Error(`CalmHubDocumentLoader rejected path containing directory traversal in: ${documentId}`);
        }
        const path = url.pathname;

        if (!CALM_HUB_ALLOWED_PATHS.some(pattern => pattern.test(path))) {
            throw new Error(`CalmHubDocumentLoader rejected path '${path}' as it does not match any known CalmHub API endpoint.`);
        }

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${path}`);

        // TODO gracefully handle 404s and other errors
        const response = await this.ax.get(path);
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