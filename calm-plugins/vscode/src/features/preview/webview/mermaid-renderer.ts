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

    async render(mdText: string): Promise<string> {
        const initialHtml = this.md.render(String(mdText ?? ''))
        this.ensureMermaid()

        const container = document.createElement('div')
        container.innerHTML = initialHtml

        const codes = container.querySelectorAll('code.language-mermaid')
        if (!codes.length) return container.innerHTML

        let i = 0
        for (const code of Array.from(codes)) {
            const graph = code.textContent ?? ''
            const pre = code.parentElement?.tagName.toLowerCase() === 'pre' ? code.parentElement! : code
            try {
                const id = `mmd-${++i}`
                const out = await mermaid.render(id, graph) // v10+: { svg, bindFunctions }
                const shell = document.createElement('div')
                shell.innerHTML = out.svg
                const svgEl = shell.firstElementChild
                if (svgEl) pre.replaceWith(svgEl)
            } catch (e) {
                const err = document.createElement('pre')
                err.textContent = 'Mermaid error: ' + String(e)
                pre.replaceWith(err)
            }
        }

        return container.innerHTML
    }
}
