import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

function getNonce() {
    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    return text
}

export class HtmlBuilder {
  constructor(private context: vscode.ExtensionContext) {}
  getHtml(panel: vscode.WebviewPanel) {
    let version = 'unknown'
    try {
      const pkgUri = vscode.Uri.joinPath(this.context.extensionUri, 'package.json')
      const pkg = require(pkgUri.fsPath)
      if (pkg?.version) version = String(pkg.version)
    } catch {}
    const webview = panel.webview
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'main.global.js'))
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.css'))
    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'preview.html')
    let html = fs.readFileSync(htmlPath.fsPath, 'utf8')
    html = html
        .replace(/{{cspSource}}/g, webview.cspSource)
        .replace(/{{styleUri}}/g, String(styleUri))
        .replace(/{{scriptUri}}/g, String(scriptUri))
        .replace(/{{nonce}}/g, nonce)
        .replace(/{{version}}/g, version)
    return html
  }
}
