import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import {
    buildDocumentLoader,
    DocumentLoader,
    DocumentLoaderOptions
} from '@finos/calm-shared'
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

    private async initializeLoader(basePath: string) {
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

                try {
                    const content = await fs.promises.readFile(resolvedMappingPath, 'utf-8')
                    this.logger.info(`[navigation] Loading URL mapping from: ${resolvedMappingPath}`)
                    const mappingJson = JSON.parse(content)
                    urlToLocalMap = new Map(
                        Object.entries(mappingJson).map(([url, relativePath]) => [
                            url,
                            path.resolve(path.dirname(resolvedMappingPath), String(relativePath))
                        ])
                    )
                    this.urlToLocalMap = urlToLocalMap
                } catch (err: any) {
                    if (err.code === 'ENOENT') {
                        this.logger.warn?.(`[navigation] URL mapping file not found: ${resolvedMappingPath}`)
                    } else {
                        throw err
                    }
                }
            } catch (err: any) {
                if (err instanceof SyntaxError) {
                    this.logger.error?.(
                        `[navigation] Invalid JSON in URL mapping file "${mappingPath}": ${err.message}`
                    )
                } else {
                    this.logger.error?.(
                        `[navigation] Failed to load URL mapping from "${mappingPath}": ${err.message}`
                    )
                }
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

        return this.navigateToDetailedArchitecture(detailedArch)
    }

    /**
     * Navigate to a detailed-architecture reference, resolving via url mapping if configured
     * For relative paths, resolves from the current active document's directory
     */
    async navigateToDetailedArchitecture(detailedArch: string): Promise<boolean> {
        this.logger.info(`[navigation] Attempting to navigate to detailed-architecture: ${detailedArch}`)

        // For relative paths (not URLs), resolve from current document's directory
        if (!detailedArch.startsWith('http') && !path.isAbsolute(detailedArch)) {
            const activeEditor = vscode.window.activeTextEditor
            if (activeEditor) {
                const currentDir = path.dirname(activeEditor.document.uri.fsPath)
                const resolvedPath = path.resolve(currentDir, detailedArch)
                this.logger.info(`[navigation] Resolved relative path to: ${resolvedPath}`)

                if (fs.existsSync(resolvedPath)) {
                    try {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath))
                        await vscode.window.showTextDocument(doc, {
                            viewColumn: vscode.ViewColumn.One,
                            preview: false
                        })
                        return true
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error)
                        this.logger.error?.(`[navigation] Failed to open file ${resolvedPath}: ${message}`)
                        vscode.window.showErrorMessage(`Failed to open file: ${resolvedPath}. ${message}`)
                        return false
                    }
                } else {
                    vscode.window.showWarningMessage(`File not found: ${resolvedPath}`)
                    return false
                }
            }
        }

        // Initialize loader with current workspace context if needed
        if (!this.docLoader && vscode.workspace.workspaceFolders?.[0]) {
            await this.initializeLoader(vscode.workspace.workspaceFolders[0].uri.fsPath)
        }

        if (!this.docLoader) {
            this.logger.error?.('[navigation] DocumentLoader not initialized (no workspace open?)')
            return false
        }

        // Use DocumentLoader to resolve the path (encapsulates mapping and relative path logic)
        const targetPath = this.docLoader.resolvePath(detailedArch)

        if (targetPath && fs.existsSync(targetPath)) {
            this.logger.info(`[navigation] Resolved to local file: ${targetPath}`)
            try {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath))
                // Open in a new tab (preview: false) in Column 1, don't replace existing tabs
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.One,
                    preview: false  // Opens as a permanent tab, not a preview that gets replaced
                })
                return true
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                this.logger.error?.(`[navigation] Failed to open file ${targetPath}: ${message}`)
                vscode.window.showErrorMessage(`Failed to open file: ${targetPath}. ${message}`)
                return false
            }
        } else {
            this.logger.warn?.(`[navigation] Could not resolve local file for: ${detailedArch}`)

            const mappingPath = this.config.urlMapping()

            if (detailedArch.startsWith('http')) {
                if (!mappingPath) {
                    vscode.window.showWarningMessage(
                        `Cannot open "${detailedArch}". No URL mapping configured.\n\nSet "calm.urlMapping" in settings to point to a JSON file that maps URLs to local paths.`,
                        'Open Settings'
                    ).then(selection => {
                        if (selection === 'Open Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'calm.urlMapping')
                        }
                    })
                } else {
                    vscode.window.showWarningMessage(
                        `Cannot open "${detailedArch}".\n\nAdd a mapping for this URL in your calm-mapping.json file:\n"${detailedArch}": "./path/to/local/file.json"`,
                        'Open Mapping File'
                    ).then(async selection => {
                        if (selection === 'Open Mapping File') {
                            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                            if (!workspaceRoot && !path.isAbsolute(mappingPath)) {
                                vscode.window.showErrorMessage('Cannot open mapping file: no workspace folder open and path is relative')
                                return
                            }
                            try {
                                const resolvedPath = path.isAbsolute(mappingPath)
                                    ? mappingPath
                                    : path.join(workspaceRoot!, mappingPath)
                                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(resolvedPath))
                                await vscode.window.showTextDocument(doc)
                            } catch {
                                vscode.window.showErrorMessage(`Could not open mapping file: ${mappingPath}`)
                            }
                        }
                    })
                }
            } else {
                vscode.window.showWarningMessage(`File not found: ${detailedArch}`)
            }
            
            return false
        }
    }
}
