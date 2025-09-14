import * as vscode from 'vscode'
import { LoggingService } from './services/logging-service'
import type { Logger } from './ports/logger'
import { ConfigService } from './services/config-service'
import { ConfigPort } from './ports/config.port'
import { RefreshService } from './services/refresh-service'
import { SelectionService } from './services/selection-service'
import { PreviewManager } from '../ui/preview-manager'
import { WatchService } from './services/watch-service'
import { TreeViewManager } from '../ui/tree-view-manager'
import { LanguageFeaturesRegistrar } from '../ui/language-features-registrar'
import { CommandRegistrar } from '../commands/command-registrar'
import { DiagnosticsService } from './services/diagnostics-service'
import { EditorGateway } from '../ui/editor-gateway'

export class CalmExtensionController {
  private disposables: vscode.Disposable[] = []
  private logging: LoggingService | undefined

  async start(context: vscode.ExtensionContext) {
    // Logging (adapter) + Logger port for core
    this.logging = new LoggingService('vscode-ext')
    const log: Logger = this.logging
    const output = this.logging.output // still used by UI adapters/commands that expect OutputChannel

    // Async, non-blocking diagnostics
    const diagnostics = new DiagnosticsService(log)
    void diagnostics.logStartup(context)

    // Services - use ports for hexagonal architecture
    const configService = new ConfigService() // This implements ConfigPort
    const configPort: ConfigPort = configService // Use as port interface
    const previewManager = new PreviewManager()

    // Refresh service needs the getter; declare then assign
    let refreshService!: RefreshService

    const treeManager = new TreeViewManager(() => refreshService?.getModelIndex())
    const treeView = treeManager.getTreeView()
    const treeProvider = treeManager.getProvider()
    context.subscriptions.push(treeView)

    refreshService = new RefreshService(
        log,
        configPort, // Use port interface
        {
          setModel: m => treeProvider.setModel(m),
          setTemplateMode: e => treeProvider.setTemplateMode(e)
        },
        () => previewManager.get()
    )

    let isCurrentlyInTemplateMode = false
    const setTemplateMode = (enabled: boolean) => { isCurrentlyInTemplateMode = enabled }

    // Editor gateway centralizes editor lifecycle bridges
    const editorGateway = new EditorGateway(() => refreshService.getModelIndex())

    const selectionService = new SelectionService(
        () => refreshService.getModelIndex(),
        () => previewManager.get(),
        { revealById: (id: string) => treeManager.revealById(id) },
        (doc, id) => editorGateway.revealById(doc, id),
        () => isCurrentlyInTemplateMode
    )

    // Wire UI/event bridges
    treeManager.bindSelectionService(selectionService)                                                    // tree → preview/editor
    editorGateway.bindSelectionService(selectionService)                                                  // caret → preview
    editorGateway.bindActiveEditorWatcher(previewManager, refreshService, setTemplateMode, output)        // active editor → preview+refresh

    // Watchers (FS + open/save → refresh) - use port interface
    const watchService = new WatchService(configPort, refreshService)
    watchService.registerAll(context)

    // Language features
    const langRegistrar = new LanguageFeaturesRegistrar(() => refreshService.getModelIndex())
    langRegistrar.registerAll()

    // Commands - still use concrete service for backwards compatibility with CommandDeps
    new CommandRegistrar({
      ctx: context,
      output,                      // UI command package still expects OutputChannel
      config: configService,       // Commands still expect concrete service
      refresh: refreshService,
      selection: selectionService,
      tree: treeManager,
      preview: previewManager,
      setTemplateMode
    }).registerAll()
  }

  dispose() {
    this.logging?.dispose()
    this.disposables.forEach(d => { try { d.dispose() } catch {} })
  }
}
