import * as vscode from 'vscode'
import * as fs from 'fs'
import { detectFileType, FileType } from '../../domain/file-types'
import { loadCalmModel, ModelIndex, toGraph } from '../../domain/model'
import { ConfigPort } from '../ports/config.port'
import { TreeAdapter } from './tree-adapter'
import type { Logger } from '../ports/logger'

export interface RefreshResult {
    modelIndex: ModelIndex | undefined
    isTemplateMode: boolean
}

export class RefreshService {
    private refreshTimeout: NodeJS.Timeout | undefined
    private currentModelIndex: ModelIndex | undefined

    constructor(
        private log: Logger,
        private config: ConfigPort, // Use port instead of concrete service
        private tree: TreeAdapter,
        private getPreview: () =>
            | { setData: (data: any) => void; postSelect: (id: string) => void }
            | undefined
    ) {}

    getModelIndex() {
        return this.currentModelIndex
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

            this.tree.setTemplateMode(isTemplateMode)

            let docForIndex = doc
            if (fileInfo.type === FileType.TemplateFile && fileInfo.isValid && fileInfo.architecturePath) {
                docForIndex = {
                    getText: () => text,
                    positionAt: () => doc.positionAt(0),
                    uri: doc.uri
                } as any
            }

            this.currentModelIndex = new ModelIndex(docForIndex, model)
            this.tree.setModel(this.currentModelIndex)

            const graph = toGraph(model, this.config)
            const preview = this.getPreview()
            preview?.setData({ graph, selectedId: undefined, settings: this.getPreviewSettings() })

            if (preview) {
                preview.postSelect('')
                this.log.info('[extension] Cleared TreeView selection for new file')
            }

            return { modelIndex: this.currentModelIndex, isTemplateMode }
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
