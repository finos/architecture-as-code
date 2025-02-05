import axios, { AxiosInstance } from "axios";
import { SchemaDirectory } from "../schema-directory";
import { CalmDocumentType } from "../types";
import { DocumentLoader } from "./document-loader";
import { Logger } from "winston";
import { initLogger } from "../commands/helper";

export class CALMHubDocumentLoader implements DocumentLoader {
    private readonly calmHubUrl: string;
    private readonly ax:AxiosInstance;
    private readonly logger: Logger;

    constructor(calmHubUrl: string, debug: boolean) {
        this.calmHubUrl = calmHubUrl;
        this.ax = axios.create({
            baseURL: calmHubUrl
        });
        this.logger = initLogger(debug);

        if (debug) {
            this.addAxiosDebug();
        }
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            console.log('Starting Request', JSON.stringify(request, null, 2))
            return request
          })
              
        // this.ax.interceptors.response.use(response => {
        //     console.log('Response:', response)
        //     return response
        //   })
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        return
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        const url = new URL(documentId);
        const path = url.pathname;

        this.logger.debug(`Loading CALM schema from ${this.calmHubUrl}${path}`);

        const response = await this.ax.get(path)
        const document = response.data
        // TODO hack for schemas in calmhub not matching
        document['$id'] = documentId;
        // this.logger
        this.logger.debug(JSON.stringify(document))
        return document;
    }

}