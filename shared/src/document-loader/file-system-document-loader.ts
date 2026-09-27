import { DocumentLoader, DocumentLoadError } from './document-loader';
import { initLogger, Logger } from '../logger';
import { readdir, readFile } from 'fs/promises';
import { join, isAbsolute, resolve } from 'path';
import { SchemaDirectory } from '../schema-directory';
import { existsSync } from 'fs';
import { getErrorMessage } from '../error-utils';
import type { CalmDocumentType } from '@finos/calm-models/types';

export class FileSystemDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly directoryPaths: string[];
    private readonly basePath?: string;

    constructor(directoryPaths: string[], debug: boolean, basePath?: string) {
        this.logger = initLogger(debug, 'file-system-document-loader');
        this.directoryPaths = directoryPaths;
        this.basePath = basePath;
    }

    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        this.logger.debug('Initialising FileSystemDocumentLoader with directories: ' + this.directoryPaths.join(', '));
        for (const directoryPath of this.directoryPaths) {
            await this.loadDocumentsFromDirectory(schemaDirectory, directoryPath);
        }
    }

    async loadDocumentsFromDirectory(schemaDirectory: SchemaDirectory, directoryPath: string): Promise<void> {
        try {
            this.logger.debug('Loading schemas from ' + directoryPath);
            const files = await readdir(directoryPath, { recursive: true });

            const schemaPaths = files.filter(str => str.match(/^.*(json|yaml|yml)$/))
                .map(schemaPath => join(directoryPath, schemaPath));

            for (const schemaPath of schemaPaths) {
                const schemaDef = await this.loadDocument(schemaPath, 'schema');
                if (!schemaDef) {
                    // loaded schema can't be used due to having no identifier
                    continue;
                }
                const schemaId = (schemaDef as { $id: string })['$id'];
                schemaDirectory.storeDocument(schemaId, 'schema', schemaDef);
                this.logger.debug(`Loaded schema with ID ${schemaId} from ${schemaPath}.`);
            }
        } catch (err) {
            if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
                this.logger.error('Specified directory not found while loading documents: ' + directoryPath + ', error: ' + getErrorMessage(err));
            } else {
                this.logger.error(getErrorMessage(err));
            }
            throw err;
        }
    }

    async loadMissingDocument(documentId: string, type: CalmDocumentType): Promise<object> {
        const resolvedPath = this.resolvePath(documentId);
        if (resolvedPath && existsSync(resolvedPath)) {
            this.logger.debug(`Resolved relative path: ${documentId} -> ${resolvedPath}`);
            const doc = await this.loadLocalFile(resolvedPath, type);
            if (doc) {
                return doc;
            }
        }

        let exists = false;
        try {
            exists = existsSync(documentId);
        } catch (err) {
            this.logger.error(`Error checking existence of document ID ${documentId}: ${getErrorMessage(err)}. This could be because it isn't a file path.`);
        }
        if (exists) {
            this.logger.info(`${documentId} exists, loading as file...`);
            // Use an absolute path so a load failure names a path a caller can act on,
            // even when documentId itself was relative.
            const doc = await this.loadLocalFile(resolve(documentId), type);
            if (doc) {
                return doc;
            }
        } else if (this.isLocalPath(documentId)) {
            // A path with no URL scheme is ours: report the missing file rather than
            // letting a URL loader answer "Not a valid absolute URL".
            await this.loadLocalFile(resolvedPath ?? resolve(documentId), type);
        }

        this.logger.debug(`Document ID ${documentId} does not exist in file system, cannot load.`);
        const errorMessage = `Document with id [${documentId}] and type [${type}] was requested but not loaded at initialisation.
            File system document loader can only load at startup. Please ensure the schemas are present on your directory path or use CALMHub.`;
        this.logger.debug(errorMessage);
        throw new DocumentLoadError({
            name: 'OPERATION_NOT_IMPLEMENTED',
            message: errorMessage
        });
    }

    private async loadLocalFile(path: string, type: CalmDocumentType): Promise<object | undefined> {
        try {
            return await this.loadDocument(path, type);
        } catch (err) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: err instanceof SyntaxError ? `${path} is not valid JSON: ${err.message}` : getErrorMessage(err),
                cause: err instanceof Error ? err : undefined,
                recoverable: false,
            });
        }
    }

    private isLocalPath(ref: string): boolean {
        return isAbsolute(ref) || this.isRelativePath(ref);
    }

    private async loadDocument(schemaPath: string, type: CalmDocumentType): Promise<object | undefined> {
        this.logger.debug('Loading ' + schemaPath);
        const str = await readFile(schemaPath, 'utf-8');
        const parsed = JSON.parse(str);

        if (type != 'schema') {
            return parsed;
        }

        if (!parsed || !parsed['$id']) {
            this.logger.warn('Warning: bad schema found, no $id property was defined. Path: ' + schemaPath);
            return undefined;
        }

        const schemaId = parsed['$id'];

        if (!parsed['$schema']) {
            this.logger.warn('Warning, loaded schema does not have $schema set and therefore may be invalid. Path: ' + schemaPath);
        }

        this.logger.debug('Loaded schema with $id: ' + schemaId);

        return parsed;
    }

    resolvePath(reference: string): string | undefined {
        if (this.basePath && this.isRelativePath(reference)) {
            // Resolve against base path
            // Note: join handles relative segments like .. correctly
            return join(this.basePath, reference);
        }
        return undefined;
    }

    /**
     * Check if a path is relative (not absolute and not a URL)
     */
    private isRelativePath(ref: string): boolean {
        if (isAbsolute(ref)) {
            return false;
        }
        // Any URI scheme, in any case, belongs to another loader. Two or more characters keep a Windows drive letter local.
        return !/^[a-z][a-z0-9+.-]+:/i.test(ref);
    }
}