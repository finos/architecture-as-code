import { Logger } from "winston";
import { CalmDocumentType } from "../types";
import { DocumentLoader } from "./document-loader";
import { initLogger } from "../commands/helper";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { SchemaDirectory } from "../schema-directory";

export class FileSystemDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly directoryPath: string;
    // private schemaDirectory: SchemaDirectory;

    constructor(directoryPath: string, debug: boolean) {
        this.logger = initLogger(debug);
        this.directoryPath = directoryPath;
        // this.schemaDirectory = schemaDirectory;
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        try {
            // const map = new Map<string, object>();

            this.logger.debug('Loading schemas from ' + this.directoryPath);
            const files = await readdir(this.directoryPath, { recursive: true });

            const schemaPaths = files.filter(str => str.match(/^.*(json|yaml|yml)$/))
                .map(schemaPath => join(this.directoryPath, schemaPath));

            for (const schemaPath of schemaPaths) {
                const schemaDef = await this.loadDocument(schemaPath);
                const schemaId = schemaDef['$id']
                schemaDirectory.storeDocument(schemaId, 'schema', schemaDef)
                this.logger.debug(`Loaded schema with ID ${schemaId} from ${schemaPath}.`)
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                this.logger.error('Specified directory not found while loading documents: ' + this.directoryPath + ', error: ' + err.message);
            } else {
                this.logger.error(err);
            }
            throw err;
        }
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        const errorMessage = `Document with id [${documentId}] was requested but not loaded at initialisation. 
            File system document loader can only load at startup. Please ensure the schemas are present on your directory path or use CALMHub.`
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    private async loadDocument(schemaPath: string): Promise<object> {
        this.logger.debug('Loading ' + schemaPath);
        const str = await readFile(schemaPath, 'utf-8');
        const parsed = JSON.parse(str);
        const schemaId = parsed['$id'];

        // TODO this currently assumes it's a schema.
        if (!schemaId) {
            this.logger.warn('Warning: bad schema found, no $id property was defined. Path: ', schemaPath);
            return;
        }

        if (!parsed['$schema']) {
            this.logger.warn('Warning, loaded schema does not have $schema set and therefore may be invalid. Path: ', schemaPath);
        }

        this.logger.debug('Loaded schema with $id: ' + schemaId);
        
        return parsed;
    }
}