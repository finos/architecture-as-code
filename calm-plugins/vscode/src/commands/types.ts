import * as vscode from 'vscode'
import type { SelectionService } from '../core/services/selection-service'
import type { RefreshService } from '../core/services/refresh-service'
import type { ConfigService } from '../core/services/config-service'
import type { TreeViewManager } from '../ui/tree-view-manager'
import type { PreviewManager } from '../ui/preview-manager'

export type RegisterFn = (ctx: vscode.ExtensionContext) => void

export interface CommandDeps {
    ctx: vscode.ExtensionContext
    output: vscode.OutputChannel
    config: ConfigService
    refresh: RefreshService
    selection: SelectionService
    tree: TreeViewManager
    preview: PreviewManager
    setTemplateMode: (enabled: boolean) => void
}
