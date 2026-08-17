import * as vscode from 'vscode';
import * as crypto from 'crypto';

export function getWebviewHtml(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
            context.extensionUri,
            'dist',
            'webview',
            'index.css'
        )
    );
    const cspSource = webview.cspSource;
    const escapeForScript = (json: string) => json.replace(/</g, '\\u003c');
    const initialJson = escapeForScript(JSON.stringify(document.getText()));
    const calmConfig = vscode.workspace.getConfiguration('calm');
    const enabledPacks = calmConfig.get<string[]>('packs.enabled', []);
    const excludeNodes = calmConfig.get<string[]>('packs.excludeNodes', []);
    const packsJson = escapeForScript(JSON.stringify(enabledPacks));
    const excludeNodesJson = escapeForScript(JSON.stringify(excludeNodes));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'nonce-${nonce}' 'unsafe-eval';
    style-src ${cspSource} 'unsafe-inline';
    img-src ${cspSource} data:;
    font-src ${cspSource};
    connect-src ${cspSource};
  " />
  <link rel="stylesheet" href="${styleUri}" />
  <title>CALM Canvas</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__INITIAL_CALM_JSON__ = ${initialJson};
    window.__CALM_ENABLED_PACKS__ = ${packsJson};
    window.__CALM_EXCLUDE_NODES__ = ${excludeNodesJson};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
