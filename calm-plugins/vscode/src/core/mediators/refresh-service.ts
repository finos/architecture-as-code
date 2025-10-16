import * as vscode from 'vscode'
import * as fs from 'fs'
import { detectFileType, FileType } from '../../models/file-types'
import { loadCalmModel, toGraph } from '../../models/model'
import { Config } from '../ports/config'
import type { Logger } from '../ports/logger'
import { ModelIndex } from '../../models/model-index'
import type { ApplicationStoreApi } from '../../application-store'

export interface RefreshResult {
    modelIndex: ModelIndex | undefined
    isTemplateMode: boolean
}

export class RefreshService {
    private refreshTimeout: NodeJS.Timeout | undefined

    constructor(
        private log: Logger,
        private config: Config, // Use port instead of concrete service
        private getPreview: () =>
            | { setData: (data: any) => void; postSelect: (id: string) => void }
            | undefined,
        private store: ApplicationStoreApi
    ) { }

    getModelIndex() {
        return this.store.getState().currentModelIndex
    }

    async maybeRefresh(uri: vscode.Uri) {
        const active = vscode.window.activeTextEditor?.document.uri
        if (!active || active.fsPath !== uri.fsPath) return
        if (this.refreshTimeout) clearTimeout(this.refreshTimeout)
        this.refreshTimeout = setTimeout(() => {
            const doc = vscode.window.activeTextEditor?.document
            if (doc) void this.refreshForDocument(doc)
        }, 250)
    }

    async refreshForDocument(doc: vscode.TextDocument): Promise<RefreshResult | undefined> {
        try {
            this.log.info('[extension] Refreshing for document: ' + doc.uri.fsPath)
            const fileInfo = detectFileType(doc.uri.fsPath)
            this.log.info(`[extension] File type detected: ${fileInfo.type}, valid: ${fileInfo.isValid}`)

            let model: any
            let text: string
            let isTemplateMode = false

            if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid && fileInfo.architecturePath) {
                this.log.info(`[extension] Template file detected, reading architecture: ${fileInfo.architecturePath}`)
                if (!fs.existsSync(fileInfo.architecturePath)) {
                    this.log.error?.(`[extension] Architecture file not found: ${fileInfo.architecturePath}`)
                    return
                }
                text = fs.readFileSync(fileInfo.architecturePath, 'utf8')
                model = loadCalmModel(text)
                isTemplateMode = true
            } else if (fileInfo.type === FileType.ArchitectureFile && fileInfo.isValid) {
                text = doc.getText()
                model = loadCalmModel(text)
            } else {
                this.log.info('[extension] File is not a valid CALM architecture or template file, skipping refresh')
                return
            }

            let docForIndex = doc
            if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid && fileInfo.architecturePath) {
                docForIndex = {
                    getText: () => text,
                    positionAt: () => doc.positionAt(0),
                    uri: doc.uri
                } as any
            }

            const modelIndex = new ModelIndex(docForIndex, model)

            // Update store with new model and state - ViewModels will react automatically
            const store = this.store.getState()
            store.setModelIndex(modelIndex)
            // NOTE: Don't call setCurrentDocument here - it would re-trigger store reactions
            // The caller (command or store reaction) is responsible for setting the document

            // Set template mode with proper architecture path
            const architecturePath = isTemplateMode && fileInfo.architecturePath ? fileInfo.architecturePath : doc.uri.fsPath
            store.setTemplateMode(isTemplateMode, isTemplateMode ? doc.uri.fsPath : undefined, architecturePath)

            const graph = toGraph(model, this.config)
            const preview = this.getPreview()

            // Get current selection from store and check if it should be preserved
            const currentSelection = this.store.getState().selectedElementId
            const currentState = this.store.getState()

            // Determine if we should preserve the selection based on file relationships
            let shouldPreserveSelection = false
            if (currentSelection && currentState.architectureFilePath) {
                // Get the architecture file path for the new document
                let newArchitecturePath = doc.uri.fsPath
                if (isTemplateMode && fileInfo.architecturePath) {
                    // For template files, use the referenced architecture file
                    newArchitecturePath = fileInfo.architecturePath
                }

                // Debug logging
                this.log.info(`[extension] DEBUG - Current arch path: ${currentState.architectureFilePath}`)
                this.log.info(`[extension] DEBUG - New arch path: ${newArchitecturePath}`)
                this.log.info(`[extension] DEBUG - Are paths equal: ${currentState.architectureFilePath === newArchitecturePath}`)
                this.log.info(`[extension] DEBUG - Current selection: ${currentSelection}`)

                // Preserve selection if we're switching between related files (same architecture)
                shouldPreserveSelection = currentState.architectureFilePath === newArchitecturePath

                if (shouldPreserveSelection) {
                    this.log.info(`[extension] Files are related, preserving selection: ${currentSelection}`)
                } else {
                    this.log.info(`[extension] Files are unrelated (${currentState.architectureFilePath} vs ${newArchitecturePath}), clearing selection`)
                }
            } else {
                this.log.info(`[extension] DEBUG - No current selection (${currentSelection}) or no current arch path (${currentState.architectureFilePath})`)
            }

            const selectedId = shouldPreserveSelection ? currentSelection : undefined
            preview?.setData({ graph, selectedId, settings: this.getPreviewSettings() })

            // Update selection in UI
            if (preview) {
                if (selectedId) {
                    preview.postSelect(selectedId)
                    this.log.info(`[extension] Preserved TreeView selection: ${selectedId}`)
                } else {
                    preview.postSelect('')
                    this.log.info('[extension] Cleared TreeView selection for new/unrelated file')
                }
            }

            return { modelIndex, isTemplateMode }
        } catch (e: any) {
            this.log.error?.(`Failed to refresh preview: ${e?.message || e}`)
            if (e?.stack) this.log.error?.(`Stack trace: ${e.stack}`)
        }
    }

    private getPreviewSettings() {
        return {
            layout: this.config.previewLayout(),
            showLabels: this.config.showLabels()
        }
    }
}
