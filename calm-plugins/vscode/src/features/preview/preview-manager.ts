import * as vscode from 'vscode'
import { CalmPreviewPanel } from './preview-panel'
import { Logger } from '../../core/ports/logger'

export interface PreviewLike {
    setData(data: any): void
    postSelect(id: string): void
    getCurrentUri(): vscode.Uri | undefined
    reveal(uri: vscode.Uri): void
    onDidDispose(handler: () => void): void
    onRevealInEditor(handler: (id: string) => void): void
    onDidSelect(handler: (id: string) => void): void
    setGetCurrentTreeSelection(fn: () => string | undefined): void
}

export class PreviewManager {
    private current?: CalmPreviewPanel

    get(): PreviewLike | undefined {
        return this.current
    }

    createOrShow(ctx: vscode.ExtensionContext, uri: vscode.Uri, configService: any, log: Logger) {
        if (!this.current) {
            this.current = CalmPreviewPanel.createOrShow(ctx, uri, configService, log)
        } else {
            this.current.reveal(uri)
        }
        return this.current
    }

    clearOnDispose() {
        if (!this.current) return
        this.current.onDidDispose(() => { this.current = undefined })
    }
}
