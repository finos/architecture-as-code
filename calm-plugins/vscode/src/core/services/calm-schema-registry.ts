import * as vscode from 'vscode'
import type { Logger } from '../ports/logger'
import type { Config } from '../ports/config'

/**
 * Known CALM schema URL pattern.
 * Matches URLs like:
 * - https://calm.finos.org/release/1.2/meta/calm-timeline.json
 * - https://calm.finos.org/release/1.1/meta/calm.json
 * - https://calm.finos.org/draft/2025-03/meta/calm.json
 */
const CALM_SCHEMA_URL_PATTERN = /^https:\/\/calm\.finos\.org\/(release|draft)\/([^/]+)\/meta\/(.+\.json)$/

/**
 * Registry of CALM schemas bundled with the extension and from additional folders.
 * Maps schema $id URLs to local file paths for offline validation.
 */
export class CalmSchemaRegistry {
    private schemas: Map<string, string> = new Map()
    private initialized = false

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly logger: Logger,
        private readonly config: Config
    ) { }

    /**
     * Initialize the registry by scanning bundled schemas and additional folders.
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return
        }

        this.schemas.clear()

        // Load bundled schemas from extension dist/calm folder
        await this.loadBundledSchemas()

        // Load schemas from additional configured folders
        await this.loadAdditionalSchemas()

        this.initialized = true
        this.logger.info?.(`CalmSchemaRegistry initialized with ${this.schemas.size} schemas`)
    }

    /**
     * Reset the registry (e.g., when configuration changes).
     */
    reset(): void {
        this.initialized = false
        this.schemas.clear()
    }

    /**
     * Check if a $schema URL is a known CALM schema.
     */
    isKnownCalmSchema(schemaUrl: string): boolean {
        // First check if it's in our registry
        if (this.schemas.has(schemaUrl)) {
            return true
        }

        // Also check if it matches the CALM schema URL pattern
        // (even if not bundled, it's still a CALM document)
        return CALM_SCHEMA_URL_PATTERN.test(schemaUrl)
    }

    /**
     * Get the local file path for a schema URL, if available.
     */
    getSchemaPath(schemaUrl: string): string | undefined {
        return this.schemas.get(schemaUrl)
    }

    /**
     * Get all registered schema URLs.
     */
    getRegisteredSchemaUrls(): string[] {
        return Array.from(this.schemas.keys())
    }

    /**
     * Load bundled schemas from the extension's dist/calm folder.
     */
    private async loadBundledSchemas(): Promise<void> {
        const calmDir = vscode.Uri.joinPath(this.extensionUri, 'dist', 'calm')

        try {
            await this.loadSchemasFromDirectory(calmDir, 'bundled')
        } catch (error) {
            this.logger.warn?.(`Could not load bundled schemas: ${error}`)
        }
    }

    /**
     * Load schemas from additional configured folders.
     */
    private async loadAdditionalSchemas(): Promise<void> {
        const additionalFolders = this.config.schemaAdditionalFolders()
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri

        if (!workspaceRoot || additionalFolders.length === 0) {
            return
        }

        for (const folder of additionalFolders) {
            const folderUri = vscode.Uri.joinPath(workspaceRoot, folder)
            try {
                await this.loadSchemasFromDirectory(folderUri, `additional (${folder})`)
            } catch (error) {
                this.logger.warn?.(`Could not load schemas from ${folder}: ${error}`)
            }
        }
    }

    /**
     * Recursively load all JSON schemas from a directory, extracting $id for registration.
     */
    private async loadSchemasFromDirectory(dirUri: vscode.Uri, source: string): Promise<void> {
        let entries: [string, vscode.FileType][]
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri)
        } catch {
            return // Directory doesn't exist
        }

        for (const [name, type] of entries) {
            const entryUri = vscode.Uri.joinPath(dirUri, name)

            if (type === vscode.FileType.Directory) {
                await this.loadSchemasFromDirectory(entryUri, source)
            } else if (type === vscode.FileType.File && name.endsWith('.json')) {
                await this.loadSchemaFile(entryUri, source)
            }
        }
    }

    /**
     * Load a single schema file and register it by its $id.
     */
    private async loadSchemaFile(fileUri: vscode.Uri, source: string): Promise<void> {
        try {
            const content = await vscode.workspace.fs.readFile(fileUri)
            const json = JSON.parse(Buffer.from(content).toString('utf-8'))

            if (json.$id && typeof json.$id === 'string') {
                this.schemas.set(json.$id, fileUri.fsPath)
                this.logger.debug?.(`Registered schema: ${json.$id} (${source})`)
            }
        } catch (error) {
            this.logger.debug?.(`Could not parse schema ${fileUri.fsPath}: ${error}`)
        }
    }
}
