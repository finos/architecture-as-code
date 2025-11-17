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
                securityLevel: 'strict',
                theme: 'base',
                deterministicIds: true, // For better performance with large diagrams
                logLevel: 'error', // Reduce logging for better performance
                flowchart: {
                    // Better handling of long labels
                    curve: 'basis',
                    padding: 15, // Reduced for more compact layouts
                    nodeSpacing: 40, // Reduced for denser layouts
                    rankSpacing: 60, // Reduced for more compact vertical spacing
                    // Allow wrapping for edge labels
                    htmlLabels: true,
                    // Improve text wrapping
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
                try {
                    // Generate a unique ID for this diagram
                    const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`
                    
                    // Render the Mermaid diagram
                    const { svg } = await mermaid.render(diagramId, mermaidCode)
                    
                    // Wrap the SVG in a container for pan/zoom controls
                    const wrappedSvg = this.wrapSvgWithContainer(svg, diagramId)

                    // Replace the code block with the wrapped SVG
                    processedContent = processedContent.replace(match[0], wrappedSvg)
                } catch (error) {
                    console.error('Error rendering Mermaid diagram:', error)
                    // Keep the original code block if rendering fails
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
                try {
                    // Generate a unique ID for this diagram
                    const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`

                    // Render the Mermaid diagram
                    const { svg } = await mermaid.render(diagramId, mermaidCode)

                    // Wrap the SVG in a container for pan/zoom controls
                    const wrappedSvg = this.wrapSvgWithContainer(svg, diagramId)

                    // Replace the code block with the wrapped SVG
                    html = html.replace(match[0], wrappedSvg)
                } catch (error) {
                    console.error('Error rendering HTML Mermaid diagram:', error)
                    // Keep the original code block if rendering fails
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
