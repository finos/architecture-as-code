// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module before importing the module under test
vi.mock('vscode', () => {
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
      registerMcpServerDefinitionProvider: vi.fn().mockReturnValue({ dispose: vi.fn() })
    },
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
    ViewColumn: { Beside: 2 },
  };
});

import * as vscode from 'vscode';
import { openInCalmStudio } from '../openInStudio.js';

describe('openInCalmStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: openExternal returns true (desktop app found)
    (vscode.env.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  });

  it('constructs a calmstudio:// URI with the encoded file path', async () => {
    const uri = vscode.Uri.parse('/home/user/my-arch.calm.json');
    await openInCalmStudio(uri);

    const calls = (vscode.Uri.parse as unknown as { mock: { calls: unknown[][] } } | undefined);
    // We verify via openExternal call — the URI passed should contain calmstudio://
    const openExternalArg = (vscode.env.openExternal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(String(openExternalArg.fsPath ?? openExternalArg)).toContain('calmstudio://');
    void calls;
  });

  it('calls vscode.env.openExternal with the desktop URI', async () => {
    const uri = vscode.Uri.parse('/home/user/my-arch.calm.json');
    await openInCalmStudio(uri);
    expect(vscode.env.openExternal).toHaveBeenCalledOnce();
  });

  it('does NOT call showInformationMessage when openExternal returns true', async () => {
    (vscode.env.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const uri = vscode.Uri.parse('/home/user/my-arch.calm.json');
    await openInCalmStudio(uri);
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('falls back to web URL when openExternal returns false (desktop not installed)', async () => {
    (vscode.env.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const uri = vscode.Uri.parse('/home/user/my-arch.calm.json');
    await openInCalmStudio(uri);
    // Should be called twice: once for desktop URI, once for web URL
    expect(vscode.env.openExternal).toHaveBeenCalledTimes(2);
    const webCall = (vscode.env.openExternal as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(String(webCall.fsPath ?? webCall)).toContain('calmstudio.opsflow.io');
  });

  it('shows information message on web fallback', async () => {
    (vscode.env.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const uri = vscode.Uri.parse('/home/user/my-arch.calm.json');
    await openInCalmStudio(uri);
    expect(vscode.window.showInformationMessage).toHaveBeenCalledOnce();
    const msg = (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(msg).toContain('web');
  });
});
