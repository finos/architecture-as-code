import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import { PanZoomManager, PanZoomOptions } from './pan-zoom-manager'

export default class MermaidRenderer {
    private md: MarkdownIt
    private mermaidReady = false
    private panZoomManagers: Map<string, PanZoomManager> = new Map()

    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            breaks: true,
        })
    }

    private ensureMermaid() {
        if (!this.mermaidReady) {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'loose', // Required for webview environments to avoid structuredClone issues
                theme: 'base',
                deterministicIds: true, // For better performance with large diagrams
                logLevel: 'error', // Reduce logging for better performance
                flowchart: {
                    padding: 15, // Reduced for more compact layouts
                    nodeSpacing: 40, // Reduced for denser layouts
                    rankSpacing: 60, // Reduced for more compact vertical spacing
                    htmlLabels: true,
                    useMaxWidth: true
                },
                // Global settings for better rendering of large files
                maxTextSize: 2000000, // 2MB to support large architecture files
                maxEdges: 10000 // Support complex diagrams with many connections
            })
            this.mermaidReady = true
        }
    }

    /**
     * Render markdown content with Mermaid support
     */
    async render(content: string, _sourceFile: string): Promise<string> {
        this.ensureMermaid()

        try {
            // First, check for raw Mermaid blocks in markdown (```mermaid)
            const rawMermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g
            let processedContent = content
            
            // Process raw Mermaid blocks first
            let match
            while ((match = rawMermaidRegex.exec(content)) !== null) {
                const mermaidCode = match[1].trim()
                const diagramSize = mermaidCode.length
                
                try {
                    // Generate a unique ID for this diagram
                    const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`
                    
                    // Log large diagram warnings
                    if (diagramSize > 50000) {
                        console.warn(`[mermaid-renderer] Large diagram detected (${Math.round(diagramSize / 1024)}KB). Rendering may be slow.`)
                    }
                    
                    // Render the Mermaid diagram
                    const { svg } = await mermaid.render(diagramId, mermaidCode)
                    
                    // Wrap the SVG in a container for pan/zoom controls
                    const wrappedSvg = this.wrapSvgWithContainer(svg, diagramId)

                    // Replace the code block with the wrapped SVG
                    processedContent = processedContent.replace(match[0], wrappedSvg)
                } catch (error) {
                    console.error('Error rendering Mermaid diagram:', error)
                    // Show error message to user instead of silently failing
                    const errorMessage = this.createErrorDisplay(error, diagramSize)
                    processedContent = processedContent.replace(match[0], errorMessage)
                }
            }
            
            // Then, render the remaining markdown using markdown-it
            let html = this.md.render(processedContent)

            // Finally, check for any remaining HTML-encoded Mermaid blocks
            const htmlMermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g
            while ((match = htmlMermaidRegex.exec(html)) !== null) {
                // Decode HTML entities before rendering
                const encodedCode = match[1].trim()
                const mermaidCode = this.decodeHtmlEntities(encodedCode)
                const diagramSize = mermaidCode.length
                
                try {
                    // Generate a unique ID for this diagram
                    const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`

                    // Log large diagram warnings
                    if (diagramSize > 50000) {
                        console.warn(`[mermaid-renderer] Large diagram detected (${Math.round(diagramSize / 1024)}KB). Rendering may be slow.`)
                    }

                    // Render the Mermaid diagram
                    const { svg } = await mermaid.render(diagramId, mermaidCode)

                    // Wrap the SVG in a container for pan/zoom controls
                    const wrappedSvg = this.wrapSvgWithContainer(svg, diagramId)

                    // Replace the code block with the wrapped SVG
                    html = html.replace(match[0], wrappedSvg)
                } catch (error) {
                    console.error('Error rendering HTML Mermaid diagram:', error)
                    // Show error message to user instead of silently failing
                    const errorMessage = this.createErrorDisplay(error, diagramSize)
                    html = html.replace(match[0], errorMessage)
                }
            }

            return html
        } catch (error) {
            console.error('Error rendering markdown:', error)
            return `<div style="color: red;">Error rendering content: ${String(error)}</div>`
        }
    }

    /**
     * Wrap SVG in a container with a data attribute for pan/zoom initialization
     */
    private wrapSvgWithContainer(svg: string, diagramId: string): string {
        return `<div class="mermaid-diagram-container" data-diagram-id="${diagramId}">
            ${svg}
        </div>`
    }

    /**
     * Create an error display for failed diagram rendering
     */
    private createErrorDisplay(error: unknown, diagramSize: number): string {
        const sizeKB = Math.round(diagramSize / 1024)
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Check if it's likely a size-related issue
        const isSizeIssue = sizeKB > 50 || errorMessage.includes('Maximum text size') || errorMessage.includes('timeout')
        
        let suggestion = ''
        if (isSizeIssue) {
            suggestion = `
                <p style="margin-top: 8px; font-size: 12px;">
                    <strong>Suggestions:</strong>
                    <ul style="margin: 4px 0; padding-left: 20px;">
                        <li>Select a specific node or relationship to view a focused diagram</li>
                        <li>The full architecture has too many elements (${sizeKB}KB of diagram code)</li>
                    </ul>
                </p>`
        }

        return `
            <div style="
                padding: 16px;
                margin: 8px 0;
                background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
                border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
                border-radius: 4px;
                color: var(--vscode-errorForeground, #f48771);
            ">
                <strong>⚠️ Diagram rendering failed</strong>
                <p style="margin: 8px 0; font-size: 12px; opacity: 0.9;">
                    ${this.escapeHtml(errorMessage)}
                </p>
                <p style="margin: 4px 0; font-size: 11px; opacity: 0.7;">
                    Diagram size: ${sizeKB}KB
                </p>
                ${suggestion}
            </div>`
    }

    /**
     * Escape HTML to prevent XSS in error messages
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    /**
     * Decode HTML entities from markdown-it output using DOMParser for security
     */
    private decodeHtmlEntities(text: string): string {
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'text/html')
        return doc.body.textContent || ''
    }

    /**
     * Initialize pan/zoom on a diagram after it's been rendered to the DOM
     * This should be called from the view after the HTML is inserted
     */
    public initializePanZoom(containerId: string, options?: PanZoomOptions): PanZoomManager | null {
        const container = document.querySelector(`[data-diagram-id="${containerId}"]`)
        if (!container) {
            console.warn(`Container not found for diagram ID: ${containerId}`)
            return null
        }

        const svgElement = container.querySelector('svg')
        if (!svgElement) {
            console.warn(`SVG element not found in container: ${containerId}`)
            return null
        }

        // Remove any max-width/max-height constraints from Mermaid
        svgElement.style.removeProperty('max-width')
        svgElement.style.removeProperty('max-height')

        // Ensure the SVG fills the container
        svgElement.style.width = '100%'
        svgElement.style.height = '100%'

        // Create and initialize pan/zoom manager
        const panZoomManager = new PanZoomManager()
        panZoomManager.initialize(svgElement, options)

        // Store for later cleanup
        this.panZoomManagers.set(containerId, panZoomManager)

        return panZoomManager
    }

    /**
     * Clean up all pan/zoom instances
     */
    public destroyAllPanZoom(): void {
        this.panZoomManagers.forEach(manager => manager.destroy())
        this.panZoomManagers.clear()
    }

    /**
     * Get pan/zoom manager for a specific diagram
     */
    public getPanZoomManager(diagramId: string): PanZoomManager | undefined {
        return this.panZoomManagers.get(diagramId)
    }
}
