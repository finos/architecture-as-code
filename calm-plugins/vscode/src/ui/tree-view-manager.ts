import * as vscode from 'vscode'
import { CalmTreeProvider, CalmItem } from '../tree-view'
import { ModelIndex } from '../domain/model'
import { TreeViewModel } from '../application/view-models/tree.view-model'
import type { SelectionService } from '../core/services/selection-service'

export class TreeViewManager {
    private provider: CalmTreeProvider
    private view: vscode.TreeView<CalmItem>
    private viewModel: TreeViewModel
    private disposables: vscode.Disposable[] = []

    constructor(getModelIndex: () => ModelIndex | undefined) {
        // Create ViewModel to manage presentation logic
        this.viewModel = new TreeViewModel(getModelIndex)

        // Create provider with ViewModel
        this.provider = new CalmTreeProvider(this.viewModel)

        this.view = vscode.window.createTreeView('calmSidebar', {
            treeDataProvider: this.provider,
            showCollapseAll: true
        })

        this.provider.attach(this.view)

        // Bind ViewModel state changes to UI updates
        this.viewModel.onStateChanged(() => {
            this.provider.refresh()
        })
    }

    getTreeView() {
        return this.view
    }

    getProvider() {
        return this.provider
    }

    /** Bridge tree selection events to the SelectionService. */
    bindSelectionService(selection: SelectionService) {
        const d = this.view.onDidChangeSelection(async ev => {
            const id = ev.selection?.[0]?.id ?? ''
            await selection.syncFromTree(id)
        })
        this.disposables.push(d)
    }

    dispose() {
        for (const d of this.disposables) {
            try { d.dispose() } catch {}
        }
        this.disposables = []
    }

    getCurrentSelectionId(): string | undefined {
        return this.view.selection?.[0]?.id
    }

    async revealById(id: string) {
        await this.provider.revealById(id)
    }

    setModel(model: ModelIndex) {
        this.viewModel.refreshModel()
    }

    setTemplateMode(enabled: boolean) {
        this.viewModel.setTemplateMode(enabled)
    }

    setSearchFilter(text: string) {
        this.viewModel.setSearchFilter(text)
    }

    getSearchFilter(): string {
        return this.viewModel.getSearchFilter()
    }

    expandRoot() {
        this.viewModel.expandRoot()
    }
}
