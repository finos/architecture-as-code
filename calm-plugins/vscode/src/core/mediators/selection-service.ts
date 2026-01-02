import * as vscode from 'vscode'
import type { ApplicationStoreApi } from '../../application-store'
import type { PreviewViewModelInterface } from '../../features/preview/preview.view-model'
import { NavigationService } from '../services/navigation-service'

export interface TreeRevealer {
    revealById(id: string): Promise<void>
}

/**
 * Centralises selection propagation between:
 * - TreeView (id) → Preview highlight → Editor reveal
 * - Editor caret   → Preview highlight
 * - Preview click  → Tree reveal     → Editor reveal
 * 
 * Now uses injected Zustand store as single source of truth for selection state
 * Uses PreviewViewModelInterface for proper MVVM architecture
 */
export class SelectionService {
    constructor(
        private store: ApplicationStoreApi,
        private getPreview: () => PreviewViewModelInterface | undefined,
        private tree: TreeRevealer,
        private revealInEditor: (doc: vscode.TextDocument, id: string) => Promise<void>,
        private navigation?: NavigationService
    ) { }

    /** Tree selection changed */
    async syncFromTree(id: string) {
        if (!id) return

        const store = this.store.getState()
        if (store.isTemplateMode && id === 'template-mode-message') return

        console.log(`[selection-service] syncFromTree called with id: ${id}`)

        // Update store with new selection
        store.setSelectedElement(id)

        const preview = this.getPreview()
        console.log(`[selection-service] getPreview() returned:`, preview ? 'found preview' : 'NO PREVIEW')

        if (preview) {
            console.log(`[selection-service] calling preview.postSelect(${id})`)
            preview.postSelect(id)
        } else {
            console.log(`[selection-service] ERROR: No preview available to postSelect to!`)
        }

        const uriPath = preview?.getCurrentUriPath()
        const fallbackDoc = vscode.window.activeTextEditor?.document
        const selDoc = uriPath ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uriPath) || fallbackDoc) : fallbackDoc
        if (selDoc) await this.revealInEditor(selDoc, id)
    }

    /** Editor caret moved */
    syncFromEditor(editor: vscode.TextEditor) {
        const store = this.store.getState()
        const modelIndex = store.currentModelIndex
        const preview = this.getPreview()
        if (!modelIndex || !preview) return

        const id = modelIndex.idAt(editor.document, editor.selections[0].active)
        if (id) {
            store.setSelectedElement(id)
            preview.postSelect(id)
        }
    }

    /** Preview node clicked */
    async syncFromPreview(id: string) {
        const store = this.store.getState()
        store.setSelectedElement(id)

        try { await this.tree.revealById(id) } catch { }

        // Attempt navigation first if available
        if (this.navigation) {
            // We need the raw node data to check for detailed-architecture
            // The model index has the nodes
            const model = store.currentModelIndex
            if (model) {
                // Find node by ID
                const node = model.getNodes().find((n: any) => n.id === id)
                if (node && node.raw) {
                    const navigated = await this.navigation.navigate(id, node.raw)
                    if (navigated) {
                        // If we navigated to a new file, we don't need to update the editor
                        // for the *current* file's node selection
                        return
                    }
                }
            }
        }

        const preview = this.getPreview()
        const uriPath = preview?.getCurrentUriPath()
        const fallbackDoc = vscode.window.activeTextEditor?.document
        const targetDoc = uriPath ? (vscode.workspace.textDocuments.find(d => d.uri.fsPath === uriPath) || fallbackDoc) : fallbackDoc
        if (targetDoc) await this.revealInEditor(targetDoc, id)
    }
}
