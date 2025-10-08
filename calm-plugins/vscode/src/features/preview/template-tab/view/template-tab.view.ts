import type { TemplateViewModel } from '../view-model/template.view-model'

/**
 * TemplateTabView - Manages the DOM for the template tab in the webview
 * Keeps it simple like the original - just displays template content
 */
export class TemplateTabView {
    private viewModel: TemplateViewModel
    private container: HTMLElement

    constructor(viewModel: TemplateViewModel, container: HTMLElement) {
        this.viewModel = viewModel
        this.container = container
        this.bindViewModel()
    }

    private bindViewModel(): void {
        // Listen for template content changes
        this.viewModel.onTemplateContentChanged((data: { content: string; name: string; selectedId: string; isTemplateMode: boolean }) => {
            this.render(data.content)
        })
    }

    /**
     * Render the template content in the tab - keep it simple
     */
    private render(content: string): void {
        const displayContent = content 
            ? `<pre>${this.escapeHtml(content)}</pre>`
            : '<em>No template content available</em>'

        ;(this.container as any).innerHTML = displayContent
    }

    /**
     * Update the view when external selection changes
     */
    public updateSelection(selectedId?: string): void {
        this.viewModel.setSelectedId(selectedId || 'none')
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
     * Cleanup event listeners
     */
    public dispose(): void {
        ;(this.container as any).innerHTML = ''
    }
}