// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import { renderArchitectureToSvg } from '@calmstudio/mcp/src/tools/render.js';
import type { CalmArchitecture } from '@calmstudio/calm-core';

// ---------------------------------------------------------------------------
// Pure utility functions (exported for unit testing without VS Code API)
// ---------------------------------------------------------------------------

/**
 * Returns a 32-character random alphanumeric nonce for use in CSP headers.
 */
export function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Returns true if the given file path ends with .calm.json or .json.
 * Accepts a plain path string (for testability without VS Code API).
 */
export function isCalmFile(pathOrFsPath: string): boolean {
  return pathOrFsPath.endsWith('.calm.json') || pathOrFsPath.endsWith('.json');
}

/**
 * Generates CSP-compliant HTML wrapping an SVG for the VS Code webview panel.
 * Exported for unit testing.
 */
export function getWebviewContent(svg: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CALM Diagram Preview</title>
  <style nonce="${nonce}">
    body { margin: 0; padding: 8px; background: var(--vscode-editor-background); overflow: auto; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// CalmPreviewPanel — singleton webview panel for CALM diagram preview
// ---------------------------------------------------------------------------

export class CalmPreviewPanel {
  private static currentPanel: CalmPreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    _context: vscode.ExtensionContext,
    uri: vscode.Uri
  ) {
    this._panel = panel;

    // Set initial content and start async render
    void this._updateForUri(uri);

    // Dispose panel when user closes it
    this._panel.onDidDispose(
      () => this.dispose(),
      null,
      this._disposables
    );
  }

  /**
   * Creates a new panel or reveals and updates the existing one.
   */
  public static createOrShow(context: vscode.ExtensionContext, uri: vscode.Uri): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CalmPreviewPanel.currentPanel) {
      CalmPreviewPanel.currentPanel._panel.reveal(column);
      void CalmPreviewPanel.currentPanel._updateForUri(uri);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'calmPreview',
      'CALM Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: false,   // Static SVG only — no JS needed in webview
        localResourceRoots: []  // No local file access needed for SVG rendering
      }
    );

    CalmPreviewPanel.currentPanel = new CalmPreviewPanel(panel, context, uri);
  }

  /**
   * Updates the panel if it exists and is visible. Called from the save listener.
   */
  public static updateIfVisible(uri: vscode.Uri): void {
    if (CalmPreviewPanel.currentPanel?._panel.visible) {
      void CalmPreviewPanel.currentPanel._updateForUri(uri);
    }
  }

  private async _updateForUri(uri: vscode.Uri): Promise<void> {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(raw).toString('utf-8');
      const arch = JSON.parse(text) as CalmArchitecture;
      const svg = await renderArchitectureToSvg(arch);
      const nonce = getNonce();
      this._panel.webview.html = getWebviewContent(svg, nonce);
    } catch {
      const nonce = getNonce();
      this._panel.webview.html = getWebviewContent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">' +
        '<text x="10" y="50" font-family="sans-serif" font-size="14" fill="#c00">Failed to render diagram</text>' +
        '</svg>',
        nonce
      );
    }
  }

  private dispose(): void {
    CalmPreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
