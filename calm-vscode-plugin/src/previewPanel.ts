import * as vscode from 'vscode'
import { getNonce } from './util/webview'

export interface GraphData {
    nodes: Array<{ id: string; label: string; type?: string }>
    edges: Array<{ id: string; source: string; target: string; label?: string; type?: string }>
}

export class CalmPreviewPanel {
    public static currentPanel: CalmPreviewPanel | undefined
    private readonly panel: vscode.WebviewPanel
    private disposables: vscode.Disposable[] = []
    private revealInEditorHandlers: Array<(id: string) => void> = []
    private selectHandlers: Array<(id: string) => void> = []
    private ready = false
    private lastData: { graph: GraphData; selectedId?: string; settings?: any; positions?: Record<string, { x: number; y: number }>; viewport?: { pan: { x: number; y: number }, zoom: number } } | undefined
    private currentUri: vscode.Uri | undefined

    static createOrShow(context: vscode.ExtensionContext, uri: vscode.Uri, config: vscode.WorkspaceConfiguration, output: vscode.OutputChannel) {
        const column = vscode.ViewColumn.Beside

        if (CalmPreviewPanel.currentPanel) {
            CalmPreviewPanel.currentPanel.reveal(uri)
            return CalmPreviewPanel.currentPanel
        }

        const panel = vscode.window.createWebviewPanel(
            'calmPreview',
            'CALM Preview',
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist'), vscode.Uri.joinPath(context.extensionUri, 'media')]
            }
        )

    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, config, output)
    CalmPreviewPanel.currentPanel.currentUri = uri
        return CalmPreviewPanel.currentPanel
    }

    constructor(panel: vscode.WebviewPanel, private context: vscode.ExtensionContext, private cfg: vscode.WorkspaceConfiguration, private output: vscode.OutputChannel) {
        this.panel = panel

        // Attach message listener BEFORE setting HTML so early webview posts aren't missed
        this.panel.webview.onDidReceiveMessage((msg: any) => {
        if (msg.type === 'revealInEditor' && typeof msg.id === 'string') {
                this.revealInEditorHandlers.forEach(h => h(msg.id))
            } else if (msg.type === 'selected' && typeof msg.id === 'string') {
                this.selectHandlers.forEach(h => h(msg.id))
            } else if (msg.type === 'ready') {
                this.ready = true
                if (this.lastData) {
            this.panel.webview.postMessage({ type: 'setData', ...this.lastData })
                }
            } else if (msg.type === 'savePositions' && msg.positions && this.currentUri) {
                // Persist per-document positions (if workspaceState available)
                const key = this.positionsKey(this.currentUri)
                try { (this.context as any).workspaceState?.update?.(key, msg.positions) } catch {}
            } else if (msg.type === 'saveViewport' && msg.viewport && this.currentUri) {
                const key = this.viewportKey(this.currentUri)
                try { (this.context as any).workspaceState?.update?.(key, msg.viewport) } catch {}
            } else if (msg.type === 'clearPositions' && this.currentUri) {
                try {
                    (this.context as any).workspaceState?.update?.(this.positionsKey(this.currentUri), undefined)
                    ; (this.context as any).workspaceState?.update?.(this.viewportKey(this.currentUri), undefined)
                } catch {}
            } else if (msg.type === 'saveToggles' && msg.toggles && this.currentUri) {
                const key = this.togglesKey(this.currentUri)
                try { (this.context as any).workspaceState?.update?.(key, msg.toggles) } catch {}
            } else if (msg.type === 'log' && msg.message) {
                this.output.appendLine(`[webview] ${msg.message}`)
            } else if (msg.type === 'error' && msg.message) {
                this.output.appendLine(`[webview][error] ${msg.message}`)
                if (msg.stack) this.output.appendLine(String(msg.stack))
            }
        }, undefined, this.disposables)

        // Now set HTML after listener registration
        this.panel.webview.html = this.getHtml()

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    }

    reveal(uri: vscode.Uri) {
        this.currentUri = uri
        this.panel.reveal(vscode.ViewColumn.Beside)
    }

    getCurrentUri(): vscode.Uri | undefined { return this.currentUri }

    onDidDispose(handler: () => void) {
        this.panel.onDidDispose(handler)
    }

    onRevealInEditor(handler: (id: string) => void) {
        this.revealInEditorHandlers.push(handler)
    }

    onDidSelect(handler: (id: string) => void) {
        this.selectHandlers.push(handler)
    }

    setData(payload: { graph: GraphData; selectedId?: string; settings?: any }) {
        // Attach persisted positions for this document, if any
        const positions = (this.currentUri && (this.context as any).workspaceState?.get)
            ? (((this.context as any).workspaceState.get(this.positionsKey(this.currentUri)) as any) || undefined)
            : undefined
        const viewport = (this.currentUri && (this.context as any).workspaceState?.get)
            ? (((this.context as any).workspaceState.get(this.viewportKey(this.currentUri)) as any) || undefined)
            : undefined
        const toggles = (this.currentUri && (this.context as any).workspaceState?.get)
            ? (((this.context as any).workspaceState.get(this.togglesKey(this.currentUri)) as any) || undefined)
            : undefined
        // Merge persisted toggles into settings (without mutating caller input)
        const settings = { ...(payload.settings || {}), ...(toggles || {}) }
        this.lastData = { ...payload, settings, positions, viewport }
        if (this.ready) {
            this.panel.webview.postMessage({ type: 'setData', ...this.lastData })
        } else {
            this.output.appendLine('[preview] Webview not ready yet; queued graph payload')
        }
    }

    postSelect(id: string) {
        this.panel.webview.postMessage({ type: 'select', id })
    }

    dispose() {
        CalmPreviewPanel.currentPanel = undefined
        while (this.disposables.length) {
            const d = this.disposables.pop()
            try { d?.dispose() } catch { }
        }
    }

    private getHtml() {
        const webview = this.panel.webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.global.js'))
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.css'))
        const nonce = getNonce()
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${styleUri}" rel="stylesheet" />
<title>CALM Preview</title>
</head>
<body>
    <div id="toolbar">
    <label><input type="checkbox" id="labels" checked /> Labels</label>
        <label><input type="checkbox" id="descriptions" /> Descriptions</label>
    <button id="fit">Fit</button>
        <button id="reset">Reset</button>
  </div>
  <div id="container">
    <div id="cy"></div>
    <div id="divider" title="Drag to resize"></div>
    <div id="details"><pre id="detailsPre"></pre></div>
  </div>
        <script nonce="${nonce}">(function(){
            function post(msg){ try{ if(typeof acquireVsCodeApi==='function'){ acquireVsCodeApi().postMessage(msg); } }catch(_){} }
            if(document.readyState==='loading'){
                document.addEventListener('DOMContentLoaded', function(){ post({type:'log',message:'webview boot (domready)'}); });
            } else {
                post({type:'log',message:'webview boot'});
            }
        })();</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
    }

    private positionsKey(uri: vscode.Uri) {
        return `calm.positions:${uri.toString()}`
    }

    private viewportKey(uri: vscode.Uri) {
        return `calm.viewport:${uri.toString()}`
    }

    private togglesKey(uri: vscode.Uri) {
        return `calm.toggles:${uri.toString()}`
    }
}
