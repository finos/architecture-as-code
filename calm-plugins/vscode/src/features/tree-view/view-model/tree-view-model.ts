import { debounce, groupBy } from 'lodash'
import type { ApplicationStoreApi } from '../../../application-store'
import { Emitter } from '../../../core/emitter'
import { ItemVM } from "./tree-item-view-model";


/**
 * TreeViewModel - Framework-free MVVM ViewModel for tree presentation logic
 * No VSCode dependencies - pure presentation logic
 */
export class TreeViewModel {
    private itemsById = new Map<string, ItemVM>()
    private expandedGroups = new Set<string>()
    private unsubscribers: Array<() => void> = []

    private readonly _changed = new Emitter<void>()
    readonly onChanged = this._changed.event

    private readonly _revealRequest = new Emitter<{ id: string }>()
    readonly onRevealRequest = this._revealRequest.event

    constructor(private store: ApplicationStoreApi) {
        // Debounced rebuild to avoid excessive updates
        this.debouncedRebuild = debounce(() => {
            this.rebuild(this.store.getState())
        }, 100)

        // Subscribe to store changes
        this.unsubscribers.push(
            this.store.subscribe(() => this.debouncedRebuild())
        )

        // Initial build
        this.rebuild(this.store.getState())
    }

    private debouncedRebuild: () => void

    private rebuild(state: any) {
        this.itemsById.clear()

        // In template mode, show disabled message
        if (state.isTemplateMode) {
            this.itemsById.set('template-mode-message', {
                id: 'template-mode-message',
                label: 'Navigation unavailable in Live Docify mode',
                description: 'Switch to an architecture file to use navigation features',
                contextValue: 'template-mode-message',
                collapsibleState: 'none',
                iconPath: 'info'
            })
            this._changed.fire()
            return
        }

        // Add filter status if search is active
        if (state.searchFilter) {
            this.itemsById.set('filter-status', {
                id: 'filter-status',
                label: `Filtering by "${state.searchFilter}"`,
                description: 'Click the clear button (🗑️) in the header to remove filter',
                contextValue: 'filter-status',
                collapsibleState: 'none',
                iconPath: 'search'
            })
        }

        // Architecture root
        this.itemsById.set('group:architecture', {
            id: 'group:architecture',
            label: 'Architecture',
            childrenIds: ['group:nodes', 'group:relationships', 'group:flows'],
            collapsibleState: this.expandedGroups.has('group:architecture') ? 'expanded' : 'collapsed'
        })

        // Main groups
        this.itemsById.set('group:nodes', {
            id: 'group:nodes',
            label: 'Nodes',
            parentId: 'group:architecture',
            childrenIds: [],
            collapsibleState: 'collapsed'
        })

        this.itemsById.set('group:relationships', {
            id: 'group:relationships',
            label: 'Relationships',
            parentId: 'group:architecture',
            childrenIds: [],
            collapsibleState: 'collapsed'
        })

        this.itemsById.set('group:flows', {
            id: 'group:flows',
            label: 'Flows',
            parentId: 'group:architecture',
            childrenIds: [],
            collapsibleState: 'collapsed'
        })

        // Build from ModelIndex if available
        if (state.currentModelIndex) {
            this.buildNodesGroup(state.currentModelIndex, state.searchFilter)
            this.buildRelationshipsGroup(state.currentModelIndex, state.searchFilter)
            this.buildFlowsGroup(state.currentModelIndex, state.searchFilter)
        }

        this._changed.fire()
    }

    private buildNodesGroup(modelIndex: any, searchFilter: string) {
        const grouped = groupBy(modelIndex.nodes, (node: any) =>
            this.normalizeNodeType(node.nodeType)
        )

        const nodeTypeGroupIds: string[] = []

        for (const [normalizedType, nodes] of Object.entries(grouped)) {
            const nodeArray = nodes as any[]
            if (this.nodeTypeHasMatches(nodeArray, searchFilter)) {
                const filteredNodes = this.getFilteredNodes(nodeArray, searchFilter)
                const displayType = this.capitalizeNodeType(nodeArray[0]?.nodeType)
                const groupId = `group:nodetype:${normalizedType}`

                nodeTypeGroupIds.push(groupId)

                this.itemsById.set(groupId, {
                    id: groupId,
                    label: `${displayType} (${filteredNodes.length})`,
                    parentId: 'group:nodes',
                    childrenIds: filteredNodes.map(n => n.id),
                    collapsibleState: 'collapsed'
                })

                // Add individual nodes
                filteredNodes.forEach(node => {
                    this.itemsById.set(node.id, {
                        id: node.id,
                        label: node.label,
                        parentId: groupId,
                        contextValue: 'node',
                        collapsibleState: 'none'
                    })
                })
            }
        }

        // Update nodes group children
        const nodesGroup = this.itemsById.get('group:nodes')
        if (nodesGroup) {
            nodesGroup.childrenIds = nodeTypeGroupIds.sort()
        }
    }

    private buildRelationshipsGroup(modelIndex: any, searchFilter: string) {
        const filteredRels = this.getFilteredRelationships(modelIndex.relationships, searchFilter)

        // Update relationships group children
        const relsGroup = this.itemsById.get('group:relationships')
        if (relsGroup) {
            relsGroup.childrenIds = filteredRels.map(r => r.id)
        }

        // Add individual relationships
        filteredRels.forEach(rel => {
            this.itemsById.set(rel.id, {
                id: rel.id,
                label: rel.label || rel.id,
                parentId: 'group:relationships',
                contextValue: 'relationship',
                collapsibleState: 'none'
            })
        })
    }

    private buildFlowsGroup(modelIndex: any, searchFilter: string) {
        const filteredFlows = this.getFilteredFlows(modelIndex.flows, searchFilter)

        // Update flows group children
        const flowsGroup = this.itemsById.get('group:flows')
        if (flowsGroup) {
            flowsGroup.childrenIds = filteredFlows.map(f => f.id)
        }

        // Add individual flows
        filteredFlows.forEach(flow => {
            this.itemsById.set(flow.id, {
                id: flow.id,
                label: flow.label || flow.id,
                parentId: 'group:flows',
                contextValue: 'flow',
                collapsibleState: 'none'
            })
        })
    }

    // Query helpers for the view
    rootItems(): ItemVM[] {
        const items: ItemVM[] = []

        // Add filter status if present
        const filterStatus = this.itemsById.get('filter-status')
        if (filterStatus) items.push(filterStatus)

        // Add template message if present
        const templateMessage = this.itemsById.get('template-mode-message')
        if (templateMessage) items.push(templateMessage)

        // Add architecture group if not in template mode
        const archGroup = this.itemsById.get('group:architecture')
        if (archGroup) items.push(archGroup)

        return items
    }

    childrenOf(id: string): ItemVM[] {
        const item = this.itemsById.get(id)
        if (!item?.childrenIds) return []

        return item.childrenIds
            .map(childId => this.itemsById.get(childId))
            .filter((child): child is ItemVM => child !== undefined)
    }

    getItem(id: string): ItemVM | undefined {
        return this.itemsById.get(id)
    }

    requestReveal(id: string) {
        this._revealRequest.fire({ id })
    }
    // Helper methods
    private getFilteredNodes(nodes: any[], searchFilter: string) {
        if (!searchFilter) return nodes
        return nodes.filter(node =>
            this.matchesSearch(node.label, searchFilter) ||
            this.matchesSearch(node.id, searchFilter)
        )
    }

    private getFilteredRelationships(relationships: any[], searchFilter: string) {
        if (!searchFilter) return relationships
        return relationships.filter(rel =>
            this.matchesSearch(rel.label || rel.id, searchFilter) ||
            this.matchesSearch(rel.id, searchFilter)
        )
    }

    private getFilteredFlows(flows: any[], searchFilter: string) {
        if (!searchFilter) return flows
        return flows.filter(flow =>
            this.matchesSearch(flow.label || flow.id, searchFilter) ||
            this.matchesSearch(flow.id, searchFilter)
        )
    }

    private matchesSearch(text: string, searchFilter: string): boolean {
        if (!searchFilter) return true
        return text.toLowerCase().includes(searchFilter)
    }

    private nodeTypeHasMatches(nodes: any[], searchFilter: string): boolean {
        if (!searchFilter) return true
        return nodes.some(node =>
            this.matchesSearch(node.label, searchFilter) ||
            this.matchesSearch(node.id, searchFilter)
        )
    }

    private normalizeNodeType(nodeType: string | undefined): string {
        if (!nodeType) return 'other'
        return nodeType.toLowerCase()
    }

    private capitalizeNodeType(nodeType: string | undefined): string {
        if (!nodeType) return 'Other'
        return nodeType.charAt(0).toUpperCase() + nodeType.slice(1).toLowerCase()
    }

    dispose() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe())
        this.unsubscribers = []
        this._changed.dispose()
        this._revealRequest.dispose()
    }
}
