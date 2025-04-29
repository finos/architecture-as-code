import axios, { Axios } from "axios";
import { SchemaDirectory } from "../schema-directory";
import { CalmDocumentType, DocumentLoader } from "./document-loader";
import { Logger } from "winston";
import { initLogger } from "../logger";

export class CalmHubDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private readonly logger: Logger;

    constructor(private calmHubUrl: string, debug: boolean) {
        this.ax = axios.create({
            baseURL: calmHubUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // TODO this is far, far too verbose for -v - we really need a -vvv option like cURL
        // if (debug) {
        //     this.addAxiosDebug();
        // }

        this.logger = initLogger(debug, 'calmhub-document-loader');
        this.logger.info("Configuring CALMHub document loader with base URL: " + calmHubUrl);
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            console.log('Starting Request', JSON.stringify(request, null, 2))
            return request
          })
              
        this.ax.interceptors.response.use(response => {
            console.log('Response:', response)
            return response
          })
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        return;
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        const url = new URL(documentId);
        const path = url.pathname;

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${path}`);

        const response = await this.ax.get(path)
        const document = response.data
        this.logger.debug("Successfully loaded document from CALMHub with id " + documentId);
        return document;
    }

}