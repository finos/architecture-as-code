// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';

/**
 * Registers the CalmStudio MCP server definition provider.
 *
 * This provider exposes the bundled MCP server (dist/mcp-server/index.js) to
 * VS Code Copilot and Claude Code via the mcpServerDefinitionProviders
 * contribution point (requires VS Code ^1.99.0).
 *
 * Note: `vscode.lm.registerMcpServerDefinitionProvider` and
 * `vscode.McpStdioServerDefinition` were added in VS Code 1.99. The types in
 * `@types/vscode` may not include them in all versions, so we use type
 * assertions to keep the code working without compilation errors on older type
 * definition packages.
 */
export function registerMcpServer(context: vscode.ExtensionContext): void {
  const serverPath = vscode.Uri.joinPath(
    context.extensionUri,
    'dist',
    'mcp-server',
    'index.js'
  ).fsPath;

  const emitter = new vscode.EventEmitter<void>();

  // Use type assertion because @types/vscode may not have these APIs yet.
  // vscode.lm.registerMcpServerDefinitionProvider was added in VS Code 1.99.
  const lm = vscode.lm as unknown as {
    registerMcpServerDefinitionProvider(id: string, provider: unknown): vscode.Disposable;
  };

  // McpStdioServerDefinition is also a 1.99+ API — use type assertion similarly.
  type StdioDefinition = { label: string; command: string; args: string[]; version: string };
  const McpStdio = vscode.McpStdioServerDefinition as unknown as new (
    opts: StdioDefinition
  ) => StdioDefinition;

  context.subscriptions.push(
    lm.registerMcpServerDefinitionProvider('calmstudio.mcpServer', {
      onDidChangeMcpServerDefinitions: emitter.event,
      provideMcpServerDefinitions: async () => [
        new McpStdio({
          label: 'CalmStudio',
          command: 'node',
          args: [serverPath],
          version: '1.0.0'
        })
      ],
      resolveMcpServerDefinition: async (server: unknown) => server
    })
  );
}
