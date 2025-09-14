import * as vscode from 'vscode'

export class StateStore {
  constructor(private context: vscode.ExtensionContext) {}
  positionsKey(uri: vscode.Uri) { return `calm.positions:${uri.toString()}` }
  viewportKey(uri: vscode.Uri) { return `calm.viewport:${uri.toString()}` }
  togglesKey(uri: vscode.Uri) { return `calm.toggles:${uri.toString()}` }
  getPositions(uri: vscode.Uri) { return (this.context as any).workspaceState?.get?.(this.positionsKey(uri)) }
  getViewport(uri: vscode.Uri) { return (this.context as any).workspaceState?.get?.(this.viewportKey(uri)) }
  getToggles(uri: vscode.Uri) { return (this.context as any).workspaceState?.get?.(this.togglesKey(uri)) }
  async savePositions(uri: vscode.Uri, v: any) { return (this.context as any).workspaceState?.update?.(this.positionsKey(uri), v) }
  async saveViewport(uri: vscode.Uri, v: any) { return (this.context as any).workspaceState?.update?.(this.viewportKey(uri), v) }
  async saveToggles(uri: vscode.Uri, v: any) { return (this.context as any).workspaceState?.update?.(this.togglesKey(uri), v) }
  async clearPositions(uri: vscode.Uri) { await (this.context as any).workspaceState?.update?.(this.positionsKey(uri), undefined); await (this.context as any).workspaceState?.update?.(this.viewportKey(uri), undefined) }
}

