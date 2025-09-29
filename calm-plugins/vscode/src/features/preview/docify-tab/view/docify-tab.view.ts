import type { DocifyViewModel } from '../view-model/docify.view-model'
import MermaidRenderer from '../../webview/mermaid-renderer'

/**
 * DocifyTabView - Manages the DOM for the docify tab in the webview  
 * Keeps it simple like the original - just displays docify results
 */
export class DocifyTabView {
    private viewModel: DocifyViewModel
    private container: HTMLElement
    private markdownRenderer = new MermaidRenderer()

    constructor(viewModel: DocifyViewModel, container: HTMLElement) {
        this.viewModel = viewModel
        this.container = container
        this.bindViewModel()
        this.initialize()
    }

    private bindViewModel(): void {
        // Listen for docify results
        this.viewModel.onDocifyResult((result: { content: string; format: 'html' | 'markdown'; sourceFile: string }) => {
            this.renderResult(result).catch(error => {
                console.error('Failed to render docify result:', error)
                this.renderError('Failed to render result')
            })
        })

        // Listen for docify errors
        this.viewModel.onDocifyError((error: string) => {
            this.renderError(error)
        })
    }

    /**
     * Initialize with default state
     */
    public initialize(): void {
        ;(this.container as any).innerHTML = '<em>Initializing...</em>'
    }

    /**
     * Render docify result - keep it simple but render markdown properly
     */
    private async renderResult(result: { content: string; format: 'html' | 'markdown'; sourceFile: string }): Promise<void> {
        const { content, format } = result
        
        if (format === 'html') {
            ;(this.container as any).innerHTML = content
        } else {
            // For markdown, render it through MermaidRenderer like the original
            const renderedHtml = await this.markdownRenderer.render(content)
            ;(this.container as any).innerHTML = renderedHtml
        }
    }

    /**
     * Render docify error
     */
    private renderError(error: string): void {
        ;(this.container as any).innerHTML = `<div style="color:var(--vscode-editorError-foreground)">Error: ${this.escapeHtml(error)}</div>`
    }

    /**
     * Update the view when external selection changes
     */
    public updateSelection(_selectedId?: string): void {
        // Just update the internal state, don't auto-trigger docify
        // The TabsViewModel will handle triggering docify when appropriate
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