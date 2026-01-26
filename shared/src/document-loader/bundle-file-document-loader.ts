import { readFile } from "fs/promises";
import { Logger, initLogger } from "../logger";
import { SchemaDirectory } from "../schema-directory";
import { CalmDocumentType, DocumentLoader } from "./document-loader";

// TODO error handling
export class BundleFileDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly documentReferences: Record<string, string>;
    private readonly bundlePath: string;

    constructor(bundlePath: string, debug: boolean) {
        this.bundlePath = bundlePath;
        this.logger = initLogger(debug, 'bundle-file-document-loader');
        this.documentReferences = {};
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        const bundleFile = await readFile(this.bundlePath, 'utf-8');
        const bundle = JSON.parse(bundleFile);
        for (const id of Object.keys(bundle)) {
            const path = bundle[id];
            const obj = JSON.parse(await readFile(path, 'utf-8'));
            this.documentReferences[id] = path;

            schemaDirectory.storeDocument(id, 'schema', obj);
            this.logger.debug(`Registered document ID ${id} from bundle.`);
        }
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        if (this.documentReferences[documentId]) {
            this.logger.debug(`Loading document ID ${documentId} from bundle.`);
            const file = await readFile(this.documentReferences[documentId], 'utf-8');
            return JSON.parse(file);
        }
        throw new Error(`Document with ID ${documentId} not found in bundle.`);
    }

    resolvePath(reference: string): string | undefined {
        return this.documentReferences[reference];
    }
}