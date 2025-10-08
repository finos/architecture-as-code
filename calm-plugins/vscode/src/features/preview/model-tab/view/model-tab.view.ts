import type { CalmModelViewModel } from '../view-model/calm-model.view-model'

/**
 * ModelTabView - Manages the DOM for the model tab in the webview
 * Handles rendering model data and user interactions for the model tab
 */
export class ModelTabView {
    private viewModel: CalmModelViewModel
    private container: HTMLElement

    constructor(viewModel: CalmModelViewModel, container: HTMLElement) {
        this.viewModel = viewModel
        this.container = container
        this.bindViewModel()
    }

    private bindViewModel(): void {
        // Listen for data changes and re-render
        this.viewModel.onDataChanged(({ modelData, selectedId }) => {
            this.render(modelData, selectedId)
        })

        // Listen for selection changes to highlight elements
        this.viewModel.onSelectionChanged((selectedId) => {
            this.highlightSelection(selectedId)
        })
    }

    /**
     * Render the model data in the tab
     */
    private render(modelData: any, selectedId?: string): void {
        if (!modelData) {
            (this.container as any).innerHTML = '<em>No model data available</em>'
            return
        }

        // Filter data based on selection if provided
        const displayData = selectedId && selectedId !== 'none'
            ? this.filterDataBySelection(modelData, selectedId)
            : modelData

        // Create formatted JSON display - keep it simple like the original
        const jsonStr = JSON.stringify(displayData, null, 2)
        const escapedJson = this.escapeHtml(jsonStr)
        
        ;(this.container as any).innerHTML = `<pre>${escapedJson}</pre>`
    }

    /**
     * Filter model data to show only the selected element and related data
     */
    private filterDataBySelection(modelData: any, selectedId: string): any {
        if (!modelData.nodes) return modelData

        // Find the selected node
        const selectedNode = modelData.nodes.find((node: any) => node['unique-id'] === selectedId)
        if (!selectedNode) return modelData

        // Return focused view with selected node and related connections
        const relatedInterfaces = modelData.interfaces?.filter((iface: any) =>
            iface.from === selectedId || iface.to === selectedId
        ) || []

        const relatedNodeIds = new Set<string>()
        relatedInterfaces.forEach((iface: any) => {
            relatedNodeIds.add(iface.from)
            relatedNodeIds.add(iface.to)
        })

        const relatedNodes = modelData.nodes.filter((node: any) =>
            relatedNodeIds.has(node['unique-id'])
        )

        return {
            ...modelData,
            nodes: [selectedNode, ...relatedNodes.filter((n: any) => n['unique-id'] !== selectedId)],
            interfaces: relatedInterfaces,
            _focusedOn: selectedId,
            _totalNodes: modelData.nodes.length,
            _totalInterfaces: modelData.interfaces?.length || 0
        }
    }

    /**
     * Highlight the selected element in the display
     */
    private highlightSelection(selectedId?: string): void {
        // Remove existing highlights
        const existing = (this.container as any).querySelectorAll('.highlighted')
        existing.forEach((el: any) => el.classList.remove('highlighted'))

        if (!selectedId || selectedId === 'none') return

        // Add highlight to selected element (this would need more sophisticated JSON highlighting)
        const pre = (this.container as any).querySelector('.model-json')
        if (pre && pre.textContent?.includes(`"unique-id": "${selectedId}"`)) {
            // Simple highlighting - in a real implementation you'd parse and highlight JSON properly
            pre.innerHTML = pre.innerHTML.replace(
                new RegExp(`("unique-id":\\s*"${selectedId}")`, 'g'),
                '<span class="highlighted">$1</span>'
            )
        }
    }



    /**
     * Escape HTML to prevent XSS
     */
    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    /**
     * Update the view when external selection changes
     */
    public updateSelection(selectedId?: string): void {
        this.viewModel.setSelectedId(selectedId)
    }

    /**
     * Cleanup event listeners
     */
    public dispose(): void {
        // ViewModels handle their own disposal
        ; (this.container as any).innerHTML = ''
    }
}