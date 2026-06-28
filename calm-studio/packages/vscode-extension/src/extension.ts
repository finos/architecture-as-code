// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import { CalmPreviewPanel, isCalmFile } from './preview.js';
import { registerMcpServer } from './mcp.js';
import { openInCalmStudio } from './openInStudio.js';

/**
 * Called when the extension is activated (when a .calm.json file is opened).
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Register the "Open CALM Diagram Preview" command
  context.subscriptions.push(
    vscode.commands.registerCommand('calmstudio.openPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        CalmPreviewPanel.createOrShow(context, editor.document.uri);
      }
    })
  );

  // 2. Register the "Open in CalmStudio" command (desktop app or web fallback)
  context.subscriptions.push(
    vscode.commands.registerCommand('calmstudio.openInApp', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        void openInCalmStudio(editor.document.uri);
      }
    })
  );

  // 3. Register MCP server definition provider (VS Code ^1.99.0).
  // Wrapped in try/catch for graceful degradation on older VS Code versions
  // where vscode.lm.registerMcpServerDefinitionProvider may not exist.
  try {
    registerMcpServer(context);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[CalmStudio] MCP server registration skipped — requires VS Code 1.99+');
  }

  // 4. Register save listener — re-render preview when a .calm.json file is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isCalmFile(doc.fileName)) {
        CalmPreviewPanel.updateIfVisible(doc.uri);
      }
    })
  );

  // 5. Register active editor change listener — auto-open preview for CALM files
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isCalmFile(editor.document.uri.fsPath)) {
        CalmPreviewPanel.createOrShow(context, editor.document.uri);
      }
    })
  );
}

/**
 * Called when the extension is deactivated.
 * VS Code handles cleanup via context.subscriptions automatically.
 */
export function deactivate(): void {
  // No-op — VS Code disposes subscriptions automatically
}
