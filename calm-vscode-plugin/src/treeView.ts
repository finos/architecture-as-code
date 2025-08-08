import * as vscode from 'vscode'

export class CalmTreeProvider implements vscode.TreeDataProvider<CalmItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CalmItem | undefined | null | void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event

    constructor(private getIndex: () => ModelIndex | undefined) { }

    setModel(_index?: ModelIndex) {
        this._onDidChangeTreeData.fire()
    }

    revealById(id: string) {
        // no-op in first iteration; clicking from command handles focus
    }

    getTreeItem(element: CalmItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: CalmItem): Thenable<CalmItem[]> {
        const index = this.getIndex()
        if (!index) return Promise.resolve([])
        if (!element) {
            return Promise.resolve([
                new CalmItem('Nodes', vscode.TreeItemCollapsibleState.Collapsed, 'group:nodes'),
                new CalmItem('Relationships', vscode.TreeItemCollapsibleState.Collapsed, 'group:relationships'),
                new CalmItem('Flows', vscode.TreeItemCollapsibleState.Collapsed, 'group:flows')
            ])
        }
        const [kind, group] = element.id.split(':')
        if (kind === 'group') {
            if (group === 'nodes') return Promise.resolve(index.nodes.map(n => CalmItem.leaf(n.id, n.label, 'node')))
            if (group === 'relationships') return Promise.resolve(index.relationships.map(r => CalmItem.leaf(r.id, r.label || r.id, 'relationship')))
            if (group === 'flows') return Promise.resolve(index.flows.map(f => CalmItem.leaf(f.id, f.label || f.id, 'flow')))
        }
        return Promise.resolve([])
    }
}

export class CalmItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, public readonly id: string) {
        super(label, collapsibleState)
    }
    static leaf(id: string, label: string, contextValue: string) {
        const item = new CalmItem(label, vscode.TreeItemCollapsibleState.None, id)
        item.contextValue = contextValue
        item.command = { command: 'calm.revealInTree', title: 'Reveal', arguments: [id] } as vscode.Command
        return item
    }
}

export interface ModelIndex {
    nodes: { id: string; label: string }[]
    relationships: { id: string; label?: string }[]
    flows: { id: string; label?: string }[]
}
