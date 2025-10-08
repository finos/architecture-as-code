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
}
