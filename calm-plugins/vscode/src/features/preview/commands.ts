// Message typing
export type InMsg =
  | { type: 'revealInEditor'; id: string }
  | { type: 'selected'; id: string }
  | { type: 'ready' }
  | { type: 'runDocify'; templatePath?: string }
  | { type: 'requestModelData' }
  | { type: 'requestTemplateData' }
  | { type: 'refreshAll' }
  | { type: 'toggleLabels'; showLabels: boolean }
  | { type: 'log'; message: string }
  | { type: 'error'; message: string; stack?: string }

export function isInMsg(x: unknown): x is InMsg {
  return typeof x === 'object' && x !== null && 'type' in x
}

// Target interface that the PreviewPanel must implement. Keeps this module free of circular imports.
export interface PreviewCommandTarget {
  handleRevealInEditor(id: string): void
  handleSelected(id: string): void
  handleReady(): void
  handleRunDocify(): void
  handleRequestModelData(): void
  handleRequestTemplateData(): void
  handleRefreshAll(): void
  handleToggleLabels(showLabels: boolean): void
  handleLog(message: string): void
  handleError(message: string, stack?: string): void
}

// Command interface and registry
export interface WebviewCommand<T extends InMsg = InMsg> {
  readonly type: T['type']
  execute(msg: T): void | Promise<void>
}

export class CommandRegistry {
  private map = new Map<InMsg['type'], WebviewCommand>()
  register(cmd: WebviewCommand) { this.map.set(cmd.type, cmd) }
  dispatch(msg: InMsg) { this.map.get(msg.type)?.execute(msg as any) }
}

// Concrete command implementations - each operates on the PreviewCommandTarget
export class RevealInEditorCmd implements WebviewCommand<{ type: 'revealInEditor'; id: string }> {
  readonly type = 'revealInEditor' as const
  constructor(private p: PreviewCommandTarget) { }
  execute(m: { type: 'revealInEditor'; id: string }) { this.p.handleRevealInEditor(m.id) }
}
export class SelectedCmd implements WebviewCommand<{ type: 'selected'; id: string }> {
  readonly type = 'selected' as const
  constructor(private p: PreviewCommandTarget) { }
  execute(m: { type: 'selected'; id: string }) { this.p.handleSelected(m.id) }
}
export class ReadyCmd implements WebviewCommand<{ type: 'ready' }> {
  readonly type = 'ready' as const
  constructor(private p: PreviewCommandTarget) { }
  execute() { this.p.handleReady() }
}
export class RunDocifyCmd implements WebviewCommand<{ type: 'runDocify'; templatePath?: string }> {
  readonly type = 'runDocify' as const
  constructor(private p: PreviewCommandTarget) { }
  execute() { this.p.handleRunDocify() }
}
export class RequestModelDataCmd implements WebviewCommand<{ type: 'requestModelData' }> {
  readonly type = 'requestModelData' as const
  constructor(private p: PreviewCommandTarget) { }
  execute() { this.p.handleRequestModelData() }
}
export class RequestTemplateDataCmd implements WebviewCommand<{ type: 'requestTemplateData' }> {
  readonly type = 'requestTemplateData' as const
  constructor(private p: PreviewCommandTarget) { }
  execute() { this.p.handleRequestTemplateData() }
}
export class RefreshAllCmd implements WebviewCommand<{ type: 'refreshAll' }> {
  readonly type = 'refreshAll' as const
  constructor(private p: PreviewCommandTarget) { }
  execute() { this.p.handleRefreshAll() }
}
export class ToggleLabelsCmd implements WebviewCommand<{ type: 'toggleLabels'; showLabels: boolean }> {
  readonly type = 'toggleLabels' as const
  constructor(private p: PreviewCommandTarget) { }
  execute(m: { type: 'toggleLabels'; showLabels: boolean }) { this.p.handleToggleLabels(!!m.showLabels) }
}
export class LogCmd implements WebviewCommand<{ type: 'log'; message: string }> {
  readonly type = 'log' as const
  constructor(private p: PreviewCommandTarget) { }
  execute(m: { type: 'log'; message: string }) { this.p.handleLog(m.message) }
}
export class ErrorCmd implements WebviewCommand<{ type: 'error'; message: string; stack?: string }> {
  readonly type = 'error' as const
  constructor(private p: PreviewCommandTarget) { }
  execute(m: { type: 'error'; message: string; stack?: string }) { this.p.handleError(m.message, m.stack) }
}

