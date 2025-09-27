import * as vscode from 'vscode'
import { TreeViewModel } from './tree.view-model'

export class CalmTreeProvider implements vscode.TreeDataProvider<CalmItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CalmItem | undefined | null | void>()
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event
    private architectureGroup = new CalmItem('Architecture', vscode.TreeItemCollapsibleState.Expanded, 'group:architecture')
    private groupNodes = new CalmItem('Nodes', vscode.TreeItemCollapsibleState.Collapsed, 'group:nodes')
    private groupRels = new CalmItem('Relationships', vscode.TreeItemCollapsibleState.Collapsed, 'group:relationships')
    private groupFlows = new CalmItem('Flows', vscode.TreeItemCollapsibleState.Collapsed, 'group:flows')
    private tree: vscode.TreeView<CalmItem> | undefined

    constructor(private viewModel: TreeViewModel) { }

    // UI methods that delegate to ViewModel
    setSearchFilter(searchText: string) {
        this.viewModel.setSearchFilter(searchText)
    }

    getSearchFilter(): string {
        return this.viewModel.getSearchFilter()
    }

    setModel(_index?: any) {
        this.viewModel.refreshModel()
    }

    setTemplateMode(isTemplateMode: boolean) {
        this.viewModel.setTemplateMode(isTemplateMode)
    }

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    attach(view: vscode.TreeView<CalmItem>) { 
        this.tree = view 
    }

    async revealById(id: string) {
        if (!this.tree) return
        try {
            const elementInfo = this.viewModel.findElementById(id)
            if (!elementInfo) return

            // Create the appropriate tree item
            let item: CalmItem | undefined
            if (elementInfo.type === 'node') {
                item = CalmItem.leaf(id, elementInfo.element.label, 'node')
            } else if (elementInfo.type === 'relationship') {
                item = CalmItem.leaf(id, elementInfo.element.label || id, 'relationship')
            } else if (elementInfo.type === 'flow') {
                item = CalmItem.leaf(id, elementInfo.element.label || id, 'flow')
            }

            if (item) await this.tree.reveal(item, { select: true, focus: true, expand: true })
        } catch { /* noop */ }
    }

    getTreeItem(element: CalmItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: CalmItem): Promise<CalmItem[]> {
        // In template mode, show a disabled message
        if (this.viewModel.getTemplateMode()) {
            if (!element) {
                const messageItem = new CalmItem(
                    'Navigation unavailable in Live Docify mode',
                    vscode.TreeItemCollapsibleState.None,
                    'template-mode-message'
                )
                messageItem.tooltip = 'Switch to an architecture file to use navigation features'
                messageItem.iconPath = new vscode.ThemeIcon('info')
                messageItem.contextValue = 'template-mode-message'
                return Promise.resolve([messageItem])
            }
            return Promise.resolve([])
        }

        if (!element) {
            const children: CalmItem[] = []
            
            // Add filter status item if search is active
            const searchFilter = this.viewModel.getSearchFilter()
            if (searchFilter) {
                const filterItem = new CalmItem(
                    `Filtering by "${searchFilter}"`,
                    vscode.TreeItemCollapsibleState.None,
                    'filter-status'
                )
                filterItem.iconPath = new vscode.ThemeIcon('search')
                filterItem.contextValue = 'filter-status'
                filterItem.tooltip = 'Click the clear button (🗑️) in the header to remove filter'
                children.push(filterItem)
            }
            
            children.push(this.architectureGroup)
            return Promise.resolve(children)
        }

        const [kind, group, ...rest] = element.id.split(':')
        if (kind === 'group') {
            if (group === 'architecture') {
                return Promise.resolve([this.groupNodes, this.groupRels, this.groupFlows])
            }
            if (group === 'nodes') {
                const groupedNodes = this.viewModel.getGroupedNodes()
                const nodeTypeGroups: CalmItem[] = []

                for (const [normalizedType, nodes] of groupedNodes) {
                    if (this.viewModel.nodeTypeHasMatches(normalizedType)) {
                        const filteredNodes = this.viewModel.getFilteredNodes().filter(n =>
                            this.viewModel.normalizeNodeType(n.nodeType) === normalizedType
                        )
                        const displayType = this.viewModel.capitalizeNodeType(nodes[0]?.nodeType)
                        const groupItem = new CalmItem(
                            `${displayType} (${filteredNodes.length})`,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            `group:nodetype:${normalizedType}`
                        )
                        nodeTypeGroups.push(groupItem)
                    }
                }

                nodeTypeGroups.sort((a, b) => {
                    const labelA = (a as vscode.TreeItem).label as string
                    const labelB = (b as vscode.TreeItem).label as string
                    return labelA.localeCompare(labelB)
                })

                return Promise.resolve(nodeTypeGroups)
            }
            if (group === 'relationships') {
                const filteredRels = this.viewModel.getFilteredRelationships()
                return Promise.resolve(filteredRels.map(r => CalmItem.leaf(r.id, r.label || r.id, 'relationship')))
            }
            if (group === 'flows') {
                const filteredFlows = this.viewModel.getFilteredFlows()
                return Promise.resolve(filteredFlows.map(f => CalmItem.leaf(f.id, f.label || f.id, 'flow')))
            }
            if (group === 'nodetype' && rest.length > 0) {
                const nodeType = rest[0]
                const filteredNodes = this.viewModel.getFilteredNodes().filter(n =>
                    this.viewModel.normalizeNodeType(n.nodeType) === nodeType
                )
                return Promise.resolve(filteredNodes.map(n => CalmItem.leaf(n.id, n.label, 'node')))
            }
        }
        return Promise.resolve([])
    }

    getParent(element: CalmItem): CalmItem | undefined {
        if (!element) return undefined
        if (element.id === 'group:architecture') return undefined
        if (element.id === 'group:nodes' || element.id === 'group:relationships' || element.id === 'group:flows') {
            return this.architectureGroup
        }
        if (element.id.startsWith('group:nodetype:')) {
            return this.groupNodes
        }

        const elementInfo = this.viewModel.findElementById(element.id)
        if (!elementInfo) return undefined

        // Find which node type group this node belongs to
        if (elementInfo.type === 'node') {
            const node = elementInfo.element
            const normalizedType = this.viewModel.normalizeNodeType(node.nodeType)
            const displayType = this.viewModel.capitalizeNodeType(node.nodeType)
            const groupedNodes = this.viewModel.getGroupedNodes()
            return new CalmItem(
                `${displayType} (${groupedNodes.get(normalizedType)?.length || 0})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                `group:nodetype:${normalizedType}`
            )
        }
        if (elementInfo.type === 'relationship') return this.groupRels
        if (elementInfo.type === 'flow') return this.groupFlows
        return undefined
    }
}

export class CalmItem extends vscode.TreeItem {
    public contextValue?: string
    public tooltip?: string | vscode.MarkdownString
    public iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon

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
    nodes: { id: string; label: string; nodeType?: string }[]
    relationships: { id: string; label?: string }[]
    flows: { id: string; label?: string }[]
}
