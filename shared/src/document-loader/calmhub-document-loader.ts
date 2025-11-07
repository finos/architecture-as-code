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
            throw new Error(`CalmHubDocumentLoader only loads documents with protocol '${CALM_HUB_PROTO}'. Skipping. (Requested: ${protocol})`);
        }
        const path = url.pathname;

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${path}`);

        // TODO gracefully handle 404s and other errors
        const response = await this.ax.get(path);
        const document = response.data;
        this.logger.debug('Successfully loaded document from CALMHub with id ' + documentId);
        return document;
    }

}