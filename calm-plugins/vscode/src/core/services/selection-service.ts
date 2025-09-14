import * as vscode from 'vscode'
import type { ModelIndex } from '../../domain/model'

export interface TreeRevealer {
    revealById(id: string): Promise<void>
}

export interface PreviewLike {
    postSelect(id: string): void
    getCurrentUri(): vscode.Uri | undefined
}

/**
 * Centralises selection propagation between:
 * - TreeView (id) → Preview highlight → Editor reveal
 * - Editor caret   → Preview highlight
 * - Preview click  → Tree reveal     → Editor reveal
 */
export class SelectionService {
    constructor(
        private getModelIndex: () => ModelIndex | undefined,
        private getPreview: () => PreviewLike | undefined,
        private tree: TreeRevealer,
        private revealInEditor: (doc: vscode.TextDocument, id: string) => Promise<void>,
        private isTemplateMode: () => boolean
    ) {}

    /** Tree selection changed */
    async syncFromTree(id: string) {
        if (!id) return
        if (this.isTemplateMode() && id === 'template-mode-message') return

        const preview = this.getPreview()
        if (preview) preview.postSelect(id)

        const uri = preview?.getCurrentUri()
        const fallbackDoc = vscode.window.activeTextEditor?.document
        const selDoc = uri ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath) || fallbackDoc) : fallbackDoc
        if (selDoc) await this.revealInEditor(selDoc, id)
    }

    /** Editor caret moved */
    syncFromEditor(editor: vscode.TextEditor) {
        const modelIndex = this.getModelIndex()
        const preview = this.getPreview()
        if (!modelIndex || !preview) return
        const id = modelIndex.idAt(editor.document, editor.selections[0].active)
        if (id) preview.postSelect(id)
    }

    /** Preview node clicked */
    async syncFromPreview(id: string) {
        try { await this.tree.revealById(id) } catch {}
        const preview = this.getPreview()
        const uri = preview?.getCurrentUri()
        const fallbackDoc = vscode.window.activeTextEditor?.document
        const targetDoc = uri ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uri.fsPath) || fallbackDoc) : fallbackDoc
        if (targetDoc) await this.revealInEditor(targetDoc, id)
    }
}
