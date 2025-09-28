import * as vscode from 'vscode'
import { EditorViewModel } from './view-model/editor-view-model'
import { EditorView, type EditorViewEvents } from './view/editor-view'
import type { ApplicationStoreApi } from '../../application-store'
import type { SelectionService } from '../../core/mediators/selection-service'
import type { RefreshService } from '../../core/mediators/refresh-service'
import type { PreviewPanelFactory } from '../preview/preview-panel-factory'
import type { Logger } from '../../core/ports/logger'

/**
 * EditorFactory - MVVM Controller/Factory for editor features
 * Creates and wires up ViewModel and EditorView (which includes language features)
 */
export class EditorFactory implements vscode.Disposable {
    private disposables: vscode.Disposable[] = []

    // MVVM Components
    private readonly viewModel: EditorViewModel
    private readonly editorView: EditorView

    constructor(private store: ApplicationStoreApi) {
        // Create ViewModel (framework-free)
        this.viewModel = new EditorViewModel(this.store)
        this.disposables.push(this.viewModel)

        // Create event handlers for View → external service communication
        const events: EditorViewEvents = {
            onActiveEditorChanged: (doc: vscode.TextDocument) => {
                // This will be handled by external services via binding
                this.onActiveEditorChanged?.(doc)
            }
        }

        // Create EditorView (includes language features)
        this.editorView = new EditorView(this.viewModel, events)
        this.disposables.push(this.editorView)
    }

    // Event handler for active editor changes (set by external binding)
    private onActiveEditorChanged?: (doc: vscode.TextDocument) => void

    /**
     * Get the editor view for reveal operations
     */
    getEditorView(): EditorView {
        return this.editorView
    }

    /**
     * Reveal a specific ID in the text editor
     */
    async revealById(doc: vscode.TextDocument, id: string): Promise<void> {
        await this.editorView.revealById(doc, id)
    }

    /**
     * Bind selection service for editor selection changes
     */
    bindSelectionService(selection: SelectionService): void {
        // Replace the default onSelectionChanged handler with one that calls SelectionService
        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection(ev => {
                selection.syncFromEditor(ev.textEditor)
            })
        )
    }

    /**
     * Bind active editor watcher for preview and refresh integration
     */
    bindActiveEditorWatcher(
        preview: PreviewPanelFactory,
        refresh: RefreshService,
        setTemplateMode: (enabled: boolean) => void,
        log: Logger
    ): void {
        this.onActiveEditorChanged = (doc: vscode.TextDocument) => {
            const panel = preview.get()
            if (!panel) return

            log.info('[extension] Detected file switch, updating preview: ' + doc.uri.fsPath)
            panel.reveal(doc.uri)

            const resultP = refresh.refreshForDocument(doc)
            resultP?.then(r => {
                if (r) setTemplateMode(r.isTemplateMode)
            })
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose())
    }
}