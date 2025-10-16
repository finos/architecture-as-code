import * as vscode from 'vscode'
import type { Logger } from '../ports/logger'
import type { ApplicationStoreApi } from '../../application-store'
import type { PreviewPanelFactory } from '../../features/preview/preview-panel-factory'
import type { RefreshService } from './refresh-service'
import type { SelectionService } from './selection-service'
import {Config} from "../ports/config";

/**
 * StoreReactionMediator - Handles reactive coordination between store changes and various services
 * Decouples the main extension controller from the complex store reaction logic
 */
export class StoreReactionMediator {
  private disposables: vscode.Disposable[] = []

  constructor(
    private store: ApplicationStoreApi,
    private previewPanelFactory: PreviewPanelFactory,
    private refreshService: RefreshService,
    private selectionService: SelectionService,
    private log: Logger,
    private context: vscode.ExtensionContext,
    private configService: Config
  ) {}

  /**
   * Set up reactive relationships - services react to store changes
   */
  setupReactions() {
    let previousDocument: vscode.Uri | undefined
    let previousSelection: string | undefined

    // Subscribe to all store changes and react appropriately
    const unsubscribe = this.store.subscribe((state) => {
      // React to document changes
      if (state.currentDocumentUri !== previousDocument) {
        previousDocument = state.currentDocumentUri
        if (state.currentDocumentUri) {
          this.handleDocumentChange(state.currentDocumentUri)
        }
      }

      // React to selection changes
      if (state.selectedElementId !== previousSelection) {
        previousSelection = state.selectedElementId
        if (state.selectedElementId) {
          this.handleSelectionChange(state.selectedElementId)
        }
      }
    })

    this.disposables.push({ dispose: unsubscribe })
  }

  private async handleDocumentChange(uri: vscode.Uri) {
    this.log.info(`[extension] ========== Document changed to: ${uri.fsPath} ==========`)

    // Check if this is a user-initiated preview opening by checking if we should force-create
    const state = this.store.getState() as any
    const shouldForceCreate = state._forceCreatePreview

    if (shouldForceCreate) {
      this.log.info('[extension] ✅ Force-creating preview panel for user command')
      // Clear the flag immediately
      delete state._forceCreatePreview
    } else {
      this.log.info('[extension] ⏭️  Skipping auto-open - checking if panel exists')
    }

    let panel: any
    if (shouldForceCreate) {
      // Create the panel
      this.log.info('[extension] 🏗️  Calling previewPanelFactory.createOrShow()...')
      panel = this.previewPanelFactory.createOrShow(this.context, uri, this.configService, this.log)
      this.log.info('[extension] ✅ Panel created/shown')
    } else {
      // Only refresh if preview panel is already open - don't auto-create
      panel = this.previewPanelFactory.get()
      if (!panel) {
        this.log.info('[extension] ❌ No preview panel open, skipping auto-refresh')
        return
      }
      this.log.info('[extension] ✅ Preview panel exists, will refresh')
    }
    
    // Set up event handlers
    const getCurrentSelection = () => this.store.getState().selectedElementId
    panel.setGetCurrentTreeSelection(getCurrentSelection)
    panel.onRevealInEditor(async (id: string) => { await this.selectionService.syncFromPreview(id) })
    panel.onDidSelect(async (id: string) => { await this.selectionService.syncFromPreview(id) })
    
    // Refresh data for the document
    this.log.info('[extension] 📂 Opening text document...')
    const doc = await vscode.workspace.openTextDocument(uri)
    this.log.info('[extension] 📄 Document opened, calling refreshForDocument()...')
    await this.refreshService.refreshForDocument(doc)
    this.log.info('[extension] ========== handleDocumentChange complete ==========')
  }

  private handleSelectionChange(selectedId: string) {
    const panel = this.previewPanelFactory.get()
    if (panel) {
      panel.postSelect(selectedId)
    }
  }

  dispose() {
    this.disposables.forEach(d => { try { d.dispose() } catch { } })
  }
}