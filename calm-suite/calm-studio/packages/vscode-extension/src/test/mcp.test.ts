// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module before importing the module under test
vi.mock('vscode', () => {
  const disposable = { dispose: vi.fn() };

  const EventEmitterClass = class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  };

  const McpStdioServerDefinitionClass = class {
    label: string;
    command: string;
    args: string[];
    version: string;
    constructor(opts: { label: string; command: string; args: string[]; version: string }) {
      this.label = opts.label;
      this.command = opts.command;
      this.args = opts.args;
      this.version = opts.version;
    }
  };

  return {
    Uri: {
      parse: (s: string) => ({ fsPath: s, toString: () => s }),
      joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
        toString: () => [base.fsPath, ...parts].join('/')
      })
    },
    env: { openExternal: vi.fn().mockResolvedValue(true) },
    window: { showInformationMessage: vi.fn() },
    lm: {
      registerMcpServerDefinitionProvider: vi.fn().mockReturnValue(disposable)
    },
    EventEmitter: EventEmitterClass,
    McpStdioServerDefinition: McpStdioServerDefinitionClass,
    ViewColumn: { Beside: 2 },
  };
});

import * as vscode from 'vscode';
import { registerMcpServer } from '../mcp.js';

describe('registerMcpServer', () => {
  let mockContext: {
    extensionUri: { fsPath: string };
    subscriptions: { dispose: () => void }[];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      extensionUri: { fsPath: '/ext/path' },
      subscriptions: []
    };
  });

  it('calls vscode.lm.registerMcpServerDefinitionProvider with provider ID "calmstudio.mcpServer"', () => {
    registerMcpServer(mockContext as unknown as vscode.ExtensionContext);

    expect(vscode.lm.registerMcpServerDefinitionProvider).toHaveBeenCalledOnce();
    const [providerId] = (vscode.lm.registerMcpServerDefinitionProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(providerId).toBe('calmstudio.mcpServer');
  });

  it('adds the registered provider to context.subscriptions', () => {
    registerMcpServer(mockContext as unknown as vscode.ExtensionContext);
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('provideMcpServerDefinitions returns array with one McpStdioServerDefinition labeled "CalmStudio"', async () => {
    registerMcpServer(mockContext as unknown as vscode.ExtensionContext);

    const [, provider] = (vscode.lm.registerMcpServerDefinitionProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const definitions = await provider.provideMcpServerDefinitions();

    expect(definitions).toHaveLength(1);
    expect(definitions[0].label).toBe('CalmStudio');
  });

  it('provideMcpServerDefinitions server definition uses "node" command', async () => {
    registerMcpServer(mockContext as unknown as vscode.ExtensionContext);

    const [, provider] = (vscode.lm.registerMcpServerDefinitionProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const definitions = await provider.provideMcpServerDefinitions();

    expect(definitions[0].command).toBe('node');
  });

  it('provideMcpServerDefinitions server definition path points to dist/mcp-server/index.js', async () => {
    registerMcpServer(mockContext as unknown as vscode.ExtensionContext);

    const [, provider] = (vscode.lm.registerMcpServerDefinitionProvider as ReturnType<typeof vi.fn>).mock.calls[0];
    const definitions = await provider.provideMcpServerDefinitions();

    expect(definitions[0].args[0]).toContain('dist/mcp-server/index.js');
  });
});
