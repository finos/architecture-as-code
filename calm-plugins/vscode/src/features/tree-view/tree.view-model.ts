import { debounce, groupBy } from 'lodash'
import type { ModelIndex } from '../../domain/model-index'

/**
 * TreeViewModel - MVVM pattern for tree view presentation logic
 * Manages tree state, search filtering, and selection without VSCode dependencies
 */
export class TreeViewModel {
    private searchFilter: string = ''
    private selectedElementId: string | undefined
    private isTemplateMode: boolean = false
    private expandedGroups = new Set<string>()

    // Observable callbacks for UI updates
    private onStateChangedCallbacks = new Set<() => void>()

    constructor(private getModelIndex: () => ModelIndex | undefined) {
        // Debounced search to avoid excessive tree updates
        this.debouncedNotifyStateChanged = debounce(() => {
            this.onStateChangedCallbacks.forEach(callback => callback())
        }, 100)
    }

    private debouncedNotifyStateChanged: () => void

    // Observable pattern for view updates
    onStateChanged(callback: () => void): void {
        this.onStateChangedCallbacks.add(callback)
    }

    // Search operations
    setSearchFilter(searchText: string): void {
        this.searchFilter = searchText.toLowerCase().trim()
        this.debouncedNotifyStateChanged()
    }

    getSearchFilter(): string {
        return this.searchFilter
    }

    clearSearchFilter(): void {
        this.searchFilter = ''
        this.debouncedNotifyStateChanged()
    }

    // Template mode
    setTemplateMode(isTemplateMode: boolean): void {
        this.isTemplateMode = isTemplateMode
        if (isTemplateMode) {
            this.searchFilter = '' // Clear search in template mode
        }
        this.debouncedNotifyStateChanged()
    }

    getTemplateMode(): boolean {
        return this.isTemplateMode
    }

    // Selection management
    setSelectedElement(elementId: string): void {
        this.selectedElementId = elementId
        this.debouncedNotifyStateChanged()
    }

    getSelectedElementId(): string | undefined {
        return this.selectedElementId
    }

    // Expand/collapse management
    toggleExpanded(groupId: string): void {
        if (this.expandedGroups.has(groupId)) {
            this.expandedGroups.delete(groupId)
        } else {
            this.expandedGroups.add(groupId)
        }
        this.debouncedNotifyStateChanged()
    }

    isExpanded(groupId: string): boolean {
        return this.expandedGroups.has(groupId)
    }

    expandRoot(): void {
        this.expandedGroups.add('group:architecture')
        this.debouncedNotifyStateChanged()
    }

    // Data processing methods
    private matchesSearch(text: string): boolean {
        if (!this.searchFilter) return true
        return text.toLowerCase().includes(this.searchFilter)
    }

    getGroupedNodes(): Map<string, Array<{ id: string; label: string; nodeType?: string }>> {
        const index = this.getModelIndex()
        if (!index) return new Map()

        const grouped = groupBy(index.nodes, (node) =>
            this.normalizeNodeType(node.nodeType)
        )

        return new Map(Object.entries(grouped))
    }

    getFilteredNodes(): Array<{ id: string; label: string; nodeType?: string }> {
        const index = this.getModelIndex()
        if (!index || !this.searchFilter) return index?.nodes || []

        return index.nodes.filter(node =>
            this.matchesSearch(node.label) || this.matchesSearch(node.id)
        )
    }

    getFilteredRelationships(): Array<{ id: string; label?: string }> {
        const index = this.getModelIndex()
        if (!index || !this.searchFilter) return index?.relationships || []

        return index.relationships.filter(rel =>
            this.matchesSearch(rel.label || rel.id) || this.matchesSearch(rel.id)
        )
    }

    getFilteredFlows(): Array<{ id: string; label?: string }> {
        const index = this.getModelIndex()
        if (!index || !this.searchFilter) return index?.flows || []

        return index.flows.filter(flow =>
            this.matchesSearch(flow.label || flow.id) || this.matchesSearch(flow.id)
        )
    }

    nodeTypeHasMatches(nodeType: string): boolean {
        if (!this.searchFilter) return true
        const grouped = this.getGroupedNodes()
        const nodes = grouped.get(nodeType) || []
        return nodes.some(node =>
            this.matchesSearch(node.label) || this.matchesSearch(node.id)
        )
    }

    private normalizeNodeType(nodeType: string | undefined): string {
        if (!nodeType) return 'other'
        return nodeType.toLowerCase()
    }

    capitalizeNodeType(nodeType: string | undefined): string {
        if (!nodeType) return 'Other'
        return nodeType.charAt(0).toUpperCase() + nodeType.slice(1).toLowerCase()
    }

    // Refresh when model changes
    refreshModel(): void {
        this.debouncedNotifyStateChanged()
    }

    // Helper for finding elements by ID
    findElementById(id: string): { type: 'node' | 'relationship' | 'flow'; element: any } | null {
        const index = this.getModelIndex()
        if (!index) return null

        const node = index.nodes.find(n => n.id === id)
        if (node) return { type: 'node', element: node }

        const relationship = index.relationships.find(r => r.id === id)
        if (relationship) return { type: 'relationship', element: relationship }

        const flow = index.flows.find(f => f.id === id)
        if (flow) return { type: 'flow', element: flow }

        return null
    }
}
