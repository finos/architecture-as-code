import * as vscode from 'vscode'
import type { SelectionService } from '../core/services/selection-service'
import type { RefreshService } from '../core/services/refresh-service'
import type { ConfigService } from '../core/services/config-service'
import type { TreeViewManager } from '../features/tree-view/tree-view-manager'
import type { PreviewManager } from '../features/preview/preview-manager'
import { Logger } from '../core/ports/logger'

export type RegisterFn = (ctx: vscode.ExtensionContext) => void

export interface CommandDeps {
    ctx: vscode.ExtensionContext
    log: Logger
    config: ConfigService
    refresh: RefreshService
    selection: SelectionService
    tree: TreeViewManager
    preview: PreviewManager
    setTemplateMode: (enabled: boolean) => void
}
