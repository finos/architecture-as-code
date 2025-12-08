import { CalmDocumentType, DocumentLoader, DocumentLoadError } from './document-loader';
import { initLogger, Logger } from '../logger';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { SchemaDirectory } from '../schema-directory';
import path from 'path';

/**
 * A document loader that resolves document references using:
 * 1. URL-to-local-file mappings (e.g., https://example.com/foo.json -> ./local/foo.json)
 * 2. Relative file paths resolved against a base path
 * 
 * This loader pre-loads all mapped documents during initialisation so they're
 * available when AJV resolves $ref during schema compilation.
 */
export class MappedDocumentLoader implements DocumentLoader {
    private readonly logger: Logger;
    private readonly urlToLocalMap: Map<string, string>;
    private readonly basePath: string;

    /**
     * @param urlToLocalMap Map of URLs to local file paths
     * @param basePath Base path for resolving relative file references
     * @param debug Enable debug logging
     */
    constructor(urlToLocalMap: Map<string, string>, basePath: string, debug: boolean = false) {
        this.logger = initLogger(debug, 'mapped-document-loader');
        this.urlToLocalMap = urlToLocalMap;
        this.basePath = basePath;
        this.logger.debug(`Initialised with basePath: ${basePath}, mappings: ${urlToLocalMap.size}`);
    }

    /**
     * Pre-load all mapped documents into the schema directory.
     * This ensures they're available when AJV resolves $ref during compilation.
     */
    async initialise(schemaDirectory: SchemaDirectory): Promise<void> {
        this.logger.debug('Pre-loading mapped documents...');
        
        for (const [url, localPath] of this.urlToLocalMap) {
            try {
                const absolutePath = this.resolveLocalPath(localPath);
                
                if (!existsSync(absolutePath)) {
                    this.logger.warn(`Mapped file does not exist: ${absolutePath} (mapped from ${url})`);
                    continue;
                }

                const document = await this.loadDocumentFromPath(absolutePath);
                
                // Store by the URL (so $ref to URL resolves)
                schemaDirectory.storeDocument(url, 'schema', document);
                this.logger.debug(`Pre-loaded: ${url} -> ${absolutePath}`);
                
                // Also store by $id if present and different from URL
                const docId = document['$id'] as string | undefined;
                if (docId && docId !== url) {
                    schemaDirectory.storeDocument(docId, 'schema', document);
                    this.logger.debug(`Also stored by $id: ${docId}`);
                }
            } catch (err) {
                this.logger.warn(`Failed to pre-load ${url}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    /**
     * Attempt to load a document by ID.
     * 
     * Resolution order:
     * 1. Check URL-to-local mapping
     * 2. Check if it's a relative path (resolve against basePath)
     */
    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        this.logger.debug(`Attempting to load: ${documentId}`);

        // 1. Check URL mapping
        if (this.urlToLocalMap.has(documentId)) {
            const localPath = this.urlToLocalMap.get(documentId);
            const absolutePath = this.resolveLocalPath(localPath);
            
            this.logger.debug(`Resolved via URL mapping: ${documentId} -> ${absolutePath}`);
            return this.loadDocumentFromPath(absolutePath);
        }

        // 2. Check if it's a relative path
        if (this.isRelativePath(documentId)) {
            const absolutePath = path.resolve(this.basePath, documentId);
            
            if (existsSync(absolutePath)) {
                this.logger.debug(`Resolved relative path: ${documentId} -> ${absolutePath}`);
                return this.loadDocumentFromPath(absolutePath);
            }
        }

        // Cannot resolve - let other loaders try
        throw new DocumentLoadError({
            name: 'OPERATION_NOT_IMPLEMENTED',
            message: `MappedDocumentLoader cannot resolve: ${documentId}`
        });
    }

    /**
     * Check if a path is relative (not absolute and not a URL)
     */
    private isRelativePath(ref: string): boolean {
        if (path.isAbsolute(ref)) {
            return false;
        }
        if (ref.startsWith('http://') || ref.startsWith('https://') || 
            ref.startsWith('file://') || ref.startsWith('calm:')) {
            return false;
        }
        return true;
    }

    /**
     * Resolve a local path to an absolute path using basePath
     */
    private resolveLocalPath(localPath: string): string {
        return path.isAbsolute(localPath) 
            ? localPath 
            : path.resolve(this.basePath, localPath);
    }

    /**
     * Load and parse a JSON document from a file path
     */
    private async loadDocumentFromPath(filePath: string): Promise<object> {
        if (!existsSync(filePath)) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `File not found: ${filePath}`
            });
        }

        try {
            const content = await readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load/parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
                cause: err
            });
        }
    }
}
