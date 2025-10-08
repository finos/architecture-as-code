import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'

export default class MermaidRenderer {
    private md: MarkdownIt
    private mermaidReady = false

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
    async render(content: string, sourceFile: string): Promise<string> {
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
                    
                    // Replace the code block with the SVG
                    processedContent = processedContent.replace(match[0], svg)
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
                const mermaidCode = match[1].trim()
                try {
                    // Generate a unique ID for this diagram
                    const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`

                    // Render the Mermaid diagram
                    const { svg } = await mermaid.render(diagramId, mermaidCode)

                    // Replace the code block with the SVG
                    html = html.replace(match[0], svg)
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
}
