import * as vscode from 'vscode'
import { TreeView } from './view/tree-view'
import { CalmTreeItem } from './view/tree-item'
import { TreeViewModel } from './view-model/tree-view-model'
import type { SelectionService } from '../../core/mediators/selection-service'
import type { ApplicationStoreApi } from '../../application-store'

/**
 * TreeViewFactory - Simple factory for tree view components
 * Creates ViewModel and TreeView, letting TreeView handle its own wiring
 */
export class TreeViewFactory implements vscode.Disposable {
    private disposables: vscode.Disposable[] = []

    // MVVM Components
    private readonly vm: TreeViewModel
    private readonly treeView: TreeView

    constructor(private store: ApplicationStoreApi) {
        // Create ViewModel (framework-free)
        this.vm = new TreeViewModel(this.store)
        this.disposables.push(this.vm)

        // Create TreeView (handles its own VSCode TreeView creation and wiring)
        this.treeView = new TreeView(this.vm)
        this.disposables.push(this.treeView)
    }

    // Expose VSCode TreeView for external bindings
    getTreeView(): vscode.TreeView<CalmTreeItem> {
        return this.treeView.getVSCodeTreeView()
    }

    // Expose TreeView provider for legacy compatibility
    getProvider(): TreeView {
        return this.treeView
    }

    // Legacy reveal method - now delegates to ViewModel
    async revealById(id: string): Promise<void> {
        this.vm.requestReveal(id)
    }

    // Selection binding
    bindSelectionService(selection: SelectionService) {
        const d = this.getTreeView().onDidChangeSelection(async ev => {
            const id = ev.selection?.[0]?.vm.id ?? ''
            await selection.syncFromTree(id)
        })
        this.disposables.push(d)
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }
}