// src/webview/main.ts
import MermaidRenderer from './mermaid-renderer'

// Access VS Code API if present; otherwise fall back to no-op poster.
const vscode =
    typeof window !== 'undefined' && typeof (window as any).acquireVsCodeApi === 'function'
        ? (window as any).acquireVsCodeApi()
        : { postMessage: (_: any) => { /* noop */ } }

declare global {
    interface Window {
        renderMarkdown?: (md: string) => Promise<string>
    }
}

// Instantiate renderer and forward legacy API
const markdownRenderer = new MermaidRenderer()
window.renderMarkdown = async (mdText: string) => markdownRenderer.render(mdText)

// Error/log helpers
function postError(context: string, e: any) {
    try {
        const msg = `${context}: ${e?.message || e}`
        vscode.postMessage({ type: 'error', message: msg, stack: e?.stack })
    } catch { /* noop */ }
}

window.addEventListener('error', (ev) => {
    postError('Window error', (ev as any).error || (ev as any).message)
})

window.addEventListener('unhandledrejection', (ev: any) => {
    postError('Unhandled rejection', ev.reason)
})
