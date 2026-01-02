import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import {
    buildDocumentLoader,
    DocumentLoader,
    DocumentLoaderOptions
} from '@finos/calm-shared/dist/document-loader/document-loader'
import { Config } from '../ports/config'
import type { Logger } from '../ports/logger'

export class NavigationService {
    private docLoader: DocumentLoader | undefined
    private urlToLocalMap: Map<string, string> = new Map()

    constructor(
        private logger: Logger,
        private config: Config
    ) { }



    /**
     * Reset service state to force re-initialization on next use
     * (e.g. when configuration changes)
     */
    reset() {
        this.docLoader = undefined
        this.urlToLocalMap.clear()
        this.logger.info?.('[navigation] Configuration reset - will reload on next navigation')
    }

    private initializeLoader(basePath: string) {
        const mappingPath = this.config.urlMapping()
        let urlToLocalMap: Map<string, string> | undefined

        // Load mapping if configured
        if (mappingPath) {
            try {
                // Resolve mapping path relative to workspace root if needed
                let resolvedMappingPath = mappingPath
                if (!path.isAbsolute(mappingPath) && vscode.workspace.workspaceFolders?.[0]) {
                    resolvedMappingPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, mappingPath)
                }

                if (fs.existsSync(resolvedMappingPath)) {
                    this.logger.info(`[navigation] Loading URL mapping from: ${resolvedMappingPath}`)
                    const mappingJson = JSON.parse(fs.readFileSync(resolvedMappingPath, 'utf-8'))
                    urlToLocalMap = new Map(
                        Object.entries(mappingJson).map(([url, relativePath]) => [
                            url,
                            path.resolve(path.dirname(resolvedMappingPath), String(relativePath))
                        ])
                    )
                    this.urlToLocalMap = urlToLocalMap
                } else {
                    this.logger.warn?.(`[navigation] URL mapping file not found: ${resolvedMappingPath}`)
                }
            } catch (err: any) {
                this.logger.error?.(`[navigation] Failed to load URL mapping: ${err.message}`)
            }
        }

        const opts: DocumentLoaderOptions = {
            basePath,
            urlToLocalMap,
            debug: true // Enable debug logging for troubleshooting
        }

        this.logger.info('[navigation] Initializing DocumentLoader')
        this.docLoader = buildDocumentLoader(opts)
    }

    async navigate(nodeId: string, nodeRaw: any): Promise<boolean> {
        // Check for detailed-architecture property (direct or nested in details)
        const detailedArch = nodeRaw?.['detailed-architecture'] || nodeRaw?.details?.['detailed-architecture']
        
        if (!detailedArch) {
            this.logger.info(`[navigation] Node ${nodeId} has no detailed-architecture property`)
            return false
        }

        this.logger.info(`[navigation] Attempting to navigate to detailed-architecture: ${detailedArch}`)

        // Initialize loader with current workspace context if needed
        if (!this.docLoader && vscode.workspace.workspaceFolders?.[0]) {
            this.initializeLoader(vscode.workspace.workspaceFolders[0].uri.fsPath)
        }

        if (!this.docLoader) {
            this.logger.error?.('[navigation] DocumentLoader not initialized (no workspace open?)')
            return false
        }

        // Use DocumentLoader to resolve the path (encapsulates mapping and relative path logic)
        let targetPath = this.docLoader.resolvePath(detailedArch)

        if (targetPath && fs.existsSync(targetPath)) {
            this.logger.info(`[navigation] Resolved to local file: ${targetPath}`)
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath))
            // Open in Column 1 to avoid replacing the preview panel (which is usually in Column 2)
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
            return true
        } else {
            this.logger.warn?.(`[navigation] Could not resolve local file for: ${detailedArch}`)
            
            // If we have a URL but no mapping, maybe prompt the user?
            if (detailedArch.startsWith('http')) {
                vscode.window.showInformationMessage(`No local mapping found for URL: ${detailedArch}. Configure 'calm.urlMapping'.`)
            } else {
                 vscode.window.showInformationMessage(`File not found: ${detailedArch}`)
            }
            
            return false
        }
    }
}
