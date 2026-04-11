// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0
//
// Minimal VS Code API mock for unit testing pure functions.
// Only the types and stubs needed by preview.ts are included.

export const ViewColumn = { Beside: 2 };

export const window = {
  activeTextEditor: undefined,
  createWebviewPanel: () => ({
    reveal: () => undefined,
    onDidDispose: () => ({ dispose: () => undefined }),
    webview: { html: '' },
    dispose: () => undefined,
    visible: false
  }),
  onDidChangeActiveTextEditor: () => ({ dispose: () => undefined })
};

export const workspace = {
  fs: {
    readFile: async () => new Uint8Array()
  },
  onDidSaveTextDocument: () => ({ dispose: () => undefined })
};

export const commands = {
  registerCommand: () => ({ dispose: () => undefined })
};

export const env = {
  openExternal: async () => true
};

export class Uri {
  static parse(str: string) { return new Uri(str); }
  static joinPath(base: Uri, ...parts: string[]) {
    return new Uri([base.fsPath, ...parts].join('/'));
  }
  constructor(public readonly fsPath: string) {}
  toString() { return this.fsPath; }
}

export class Disposable {
  constructor(private readonly _fn: () => void) {}
  dispose() { this._fn(); }
}

export class EventEmitter<T> {
  event = (_listener: (e: T) => void) => ({ dispose: () => undefined });
  fire(_event: T) { /* no-op */ }
  dispose() { /* no-op */ }
}
