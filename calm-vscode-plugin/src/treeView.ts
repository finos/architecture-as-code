import * as vscode from 'vscode'

export class CalmTreeProvider implements vscode.TreeDataProvider<CalmItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CalmItem | undefined | null | void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event
    private groupNodes = new CalmItem('Nodes', vscode.TreeItemCollapsibleState.Collapsed, 'group:nodes')
    private groupRels = new CalmItem('Relationships', vscode.TreeItemCollapsibleState.Collapsed, 'group:relationships')
    private groupFlows = new CalmItem('Flows', vscode.TreeItemCollapsibleState.Collapsed, 'group:flows')
    private tree: vscode.TreeView<CalmItem> | undefined

    constructor(private getIndex: () => ModelIndex | undefined) { }

    setModel(_index?: ModelIndex) {
        this._onDidChangeTreeData.fire()
    }

    attach(view: vscode.TreeView<CalmItem>) { this.tree = view }

    async revealById(id: string) {
        if (!this.tree) return
        try {
            const index = this.getIndex()
            if (!index) return
            // Determine which group contains the id
            let item: CalmItem | undefined
            if (index.nodes.find(n => n.id === id)) item = CalmItem.leaf(id, index.nodes.find(n => n.id === id)!.label, 'node')
            else if (index.relationships.find(r => r.id === id)) item = CalmItem.leaf(id, index.relationships.find(r => r.id === id)!.label || id, 'relationship')
            else if (index.flows.find(f => f.id === id)) item = CalmItem.leaf(id, index.flows.find(f => f.id === id)!.label || id, 'flow')
            if (item) await this.tree.reveal(item, { select: true, focus: true, expand: true })
        } catch { /* noop */ }
    }

    getTreeItem(element: CalmItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: CalmItem): Thenable<CalmItem[]> {
        const index = this.getIndex()
        if (!index) return Promise.resolve([])
        if (!element) {
            return Promise.resolve([this.groupNodes, this.groupRels, this.groupFlows])
        }
        const [kind, group] = element.id.split(':')
        if (kind === 'group') {
            if (group === 'nodes') return Promise.resolve(index.nodes.map(n => CalmItem.leaf(n.id, n.label, 'node')))
            if (group === 'relationships') return Promise.resolve(index.relationships.map(r => CalmItem.leaf(r.id, r.label || r.id, 'relationship')))
            if (group === 'flows') return Promise.resolve(index.flows.map(f => CalmItem.leaf(f.id, f.label || f.id, 'flow')))
        }
        return Promise.resolve([])
    }

    getParent(element: CalmItem): CalmItem | undefined {
        if (!element) return undefined
        if (element.id.startsWith('group:')) return undefined
        const index = this.getIndex()
        if (!index) return undefined
        if (index.nodes.find(n => n.id === element.id)) return this.groupNodes
        if (index.relationships.find(r => r.id === element.id)) return this.groupRels
        if (index.flows.find(f => f.id === element.id)) return this.groupFlows
        return undefined
    }
}

export class CalmItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, public readonly id: string) {
        super(label, collapsibleState)
    }
    static leaf(id: string, label: string, contextValue: string) {
        const item = new CalmItem(label, vscode.TreeItemCollapsibleState.None, id)
        item.contextValue = contextValue
        // No command; selection navigation is handled from the preview
        return item
    }
}

export interface ModelIndex {
    nodes: { id: string; label: string }[]
    relationships: { id: string; label?: string }[]
    flows: { id: string; label?: string }[]
}
