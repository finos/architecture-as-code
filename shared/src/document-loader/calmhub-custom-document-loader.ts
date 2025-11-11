import { execFileSync } from 'child_process';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader, CALM_HUB_PROTO } from './document-loader';
import { initLogger, Logger } from '../logger';

export class CalmHubCustomDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly baseURL: string;
    private readonly wrapper: string;

    constructor(private calmHubUrl: string, calmHubWrapper: string, debug: boolean) {
        this.baseURL = calmHubUrl;
        this.wrapper = calmHubWrapper;
        this.logger = initLogger(debug, 'calmhub-custom-document-loader');
        this.logger.info('Configuring CALMHub custom document loader with base URL: ' + calmHubUrl);
    }

    async initialise(_: SchemaDirectory): Promise<void> {
        return;
    }

    async loadMissingDocument(documentId: string, _: CalmDocumentType): Promise<object> {
        const url = new URL(documentId);
        const protocol = url.protocol;
        if (protocol !== CALM_HUB_PROTO) {
            throw new Error(`CalmhubCustomDocumentLoader only loads documents with protocol '${CALM_HUB_PROTO}'. (Requested: ${protocol})`);
        }
        const path = url.pathname;

        this.logger.info(`Loading CALM from ${this.calmHubUrl}${path}`);

        try {
            const response = execFileSync(this.wrapper, ['--method', 'GET', this.baseURL + path], {
                stdio: 'pipe',
                shell: true,
                encoding: 'utf-8',
                timeout: 30000 // miliseconds
            });
            this.logger.debug('Successfully loaded document from CALMHub with path ' + path);
            this.logger.debug('' + response);
            return JSON.parse(response);
        }
        catch (err) {
            if (err.code) {
                // Spawn failed
                this.logger.error('CalmHub Wrapper spawn failed: ' + err.code);
            } else {
                // Wrapper executed but failed.
                // Error contains stderr from child.
                const { stderr } = err;
                this.logger.error('CalmHub Wrapper error code & message: ' + err.status + ' / ' + stderr);
            }
        }
        return document;
    }

}