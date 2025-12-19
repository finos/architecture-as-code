import * as vscode from 'vscode'
import { LoggingService } from './core/services/logging-service'
import type { Logger } from './core/ports/logger'
import { ConfigService } from './core/services/config-service'
import { Config } from './core/ports/config'
import { RefreshService } from './core/mediators/refresh-service'
import { SelectionService } from './core/mediators/selection-service'
import { StoreReactionMediator } from './core/mediators/store-reaction-mediator'
import { PreviewPanelFactory } from './features/preview/preview-panel-factory'
import { WatchService } from './core/mediators/watch-service'
import { TreeViewFactory } from './features/tree-view/tree-view-factory'
import { EditorFactory } from './features/editor/editor-factory'
import { CommandRegistrar } from './commands/command-registrar'
import { DiagnosticsService } from './core/services/diagnostics-service'
import { createApplicationStore, type ApplicationStoreApi } from './application-store'
import { setWidgetLogger } from '@finos/calm-shared'

/**
 * Main extension controller that orchestrates all VS Code extension functionality
 */
export class CalmExtensionController {
  private disposables: vscode.Disposable[] = []
  private logging: LoggingService | undefined

  async start(context: vscode.ExtensionContext) {
    this.logging = new LoggingService('vscode-ext')
    const log: Logger = this.logging

    // Configure calm-widgets to log to the CALM output channel
    setWidgetLogger({
      debug: (msg) => log.info?.(`[widget] ${msg}`),
      info: (msg) => log.info?.(`[widget] ${msg}`),
      warn: (msg) => log.warn?.(`[widget] ${msg}`),
      error: (msg) => log.error?.(`[widget] ${msg}`),
    })

    const diagnostics = new DiagnosticsService(log)
    const store: ApplicationStoreApi = createApplicationStore()
    void diagnostics.logStartup(context)

    const configService: Config = new ConfigService()
    const previewPanelFactory = new PreviewPanelFactory()
    const treeManager = new TreeViewFactory(store)
    const editorFactory = new EditorFactory(store)

    let _isCurrentlyInTemplateMode = false
    const setTemplateMode = (enabled: boolean) => {
      _isCurrentlyInTemplateMode = enabled
      store.getState().setTemplateMode(enabled)
    }
    const selectionService = new SelectionService(
      store,
      () => previewPanelFactory.getViewModel(),
      treeManager,
      async (doc: vscode.TextDocument, id: string) => await editorFactory.revealById(doc, id)
    )

    treeManager.bindSelectionService(selectionService)
    editorFactory.bindSelectionService(selectionService)

    const refreshService = new RefreshService(log, configService, () => previewPanelFactory.get(), store)
    editorFactory.bindActiveEditorWatcher(previewPanelFactory, refreshService, setTemplateMode, log)
    const watchService = new WatchService(configService, refreshService)
    watchService.registerAll(context)

    new CommandRegistrar(context, store).registerAll()

    const storeReactionMediator = new StoreReactionMediator(
      store,
      previewPanelFactory,
      refreshService,
      selectionService,
      log,
      context,
      configService
    )

    storeReactionMediator.setupReactions()

    this.disposables.push(
      previewPanelFactory,
      treeManager,
      editorFactory,
      storeReactionMediator
    )
  }

  dispose() {
    this.logging?.dispose()
    this.disposables.forEach(d => { try { d.dispose() } catch { } })
  }
}
