import * as vscode from 'vscode'
import { TreeViewModel } from '../view-model/tree-view-model'
import { CalmTreeItem } from './tree-item'

/**
 * TreeView - VSCode TreeDataProvider implementation
 * Pure View layer that uses ViewModel for data
 */
export class TreeView implements vscode.TreeDataProvider<CalmTreeItem>, vscode.Disposable {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<CalmTreeItem | void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    private cache = new Map<string, CalmTreeItem>()
    private disposables: vscode.Disposable[] = []

    // VSCode TreeView instance managed by this class
    private readonly vscodeTreeView: vscode.TreeView<CalmTreeItem>

    constructor(private readonly vm: TreeViewModel, viewId: string = 'calmSidebar') {
        // Create VSCode TreeView instance
        this.vscodeTreeView = vscode.window.createTreeView(viewId, {
            treeDataProvider: this,
            showCollapseAll: true
        })
        this.disposables.push(this.vscodeTreeView)

        // When ViewModel changes, refresh the view
        this.disposables.push(vm.onChanged(() => this.refresh()))

        // Wire ViewModel reveal intent → VSCode TreeView.reveal
        this.disposables.push(
            vm.onRevealRequest(async ({ id }) => {
                const item = this.getItemById(id)
                if (item) {
                    await this.vscodeTreeView.reveal(item, { select: true, focus: true, expand: true })
                }
            })
        )
    }

    // Expose VSCode TreeView for external access
    getVSCodeTreeView(): vscode.TreeView<CalmTreeItem> {
        return this.vscodeTreeView
    }

    getTreeItem(element: CalmTreeItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: CalmTreeItem): Promise<CalmTreeItem[]> {
        const list = element ? this.vm.childrenOf(element.vm.id) : this.vm.rootItems()
        return Promise.resolve(list.map(vmItem => this.materialize(vmItem)))
    }

    refresh() {
        this.cache.clear() // Clear cache when refreshing
        this._onDidChangeTreeData.fire(undefined)
    }

    getItemById(id: string): CalmTreeItem | undefined {
        const vmItem = this.vm.getItem(id)
        return vmItem ? this.materialize(vmItem) : undefined
    }

    private materialize(vmItem: any): CalmTreeItem {
        const existing = this.cache.get(vmItem.id)
        if (existing && existing.vm === vmItem) return existing

        const created = new CalmTreeItem(vmItem)
        this.cache.set(vmItem.id, created)
        return created
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }
}