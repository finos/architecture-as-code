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
    this.log.info(`[extension] Document changed to: ${uri.fsPath}`)

    const panel = this.previewPanelFactory.createOrShow(this.context, uri, this.configService, this.log)
    
    // Set up event handlers if this is a new panel
    const getCurrentSelection = () => this.store.getState().selectedElementId
    panel.setGetCurrentTreeSelection(getCurrentSelection)
    panel.onRevealInEditor(async id => { await this.selectionService.syncFromPreview(id) })
    panel.onDidSelect(async id => { await this.selectionService.syncFromPreview(id) })
    
    // Refresh data for the document
    const doc = await vscode.workspace.openTextDocument(uri)
    await this.refreshService.refreshForDocument(doc)
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