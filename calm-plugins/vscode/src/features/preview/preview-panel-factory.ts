import * as vscode from 'vscode'
import { CalmPreviewPanel } from './preview-panel'
import { PreviewViewModel, PreviewViewModelInterface } from './preview.view-model'
import { Logger } from '../../core/ports/logger'

// Legacy interface for compatibility - should be replaced with PreviewViewModelInterface
export interface PreviewLike {
    setData(data: any): void
    postSelect(id: string): void
    getCurrentUri(): vscode.Uri | undefined
    reveal(uri: vscode.Uri): void
    onDidDispose(handler: () => void): void
    onRevealInEditor(handler: (id: string) => void): void
    onDidSelect(handler: (id: string) => void): void
    setGetCurrentTreeSelection(fn: () => string | undefined): void
}

/**
 * PreviewPanelFactory - Factory for preview panel components
 * Creates ViewModel and Panel, following the same pattern as TreeViewFactory
 * Works with CalmPreviewPanel singleton but manages ViewModel lifecycle
 */
export class PreviewPanelFactory implements vscode.Disposable {
    private disposables: vscode.Disposable[] = []

    // MVVM Components
    private readonly vm: PreviewViewModel

    constructor() {
        // Create ViewModel (framework-agnostic)
        this.vm = new PreviewViewModel()
        this.disposables.push(this.vm)
    }

    /**
     * Get the PreviewViewModel directly (preferred for new code)
     */
    getViewModel(): PreviewViewModelInterface {
        return this.vm
    }

    /**
     * Get the panel (legacy compatibility)
     */
    get(): PreviewLike | undefined {
        return CalmPreviewPanel.currentPanel
    }

    /**
     * Create or show the preview panel
     * Uses our managed ViewModel to ensure proper selection synchronization
     */
    createOrShow(ctx: vscode.ExtensionContext, uri: vscode.Uri, configService: any, log: Logger): CalmPreviewPanel {
        // Use the new method that accepts our external ViewModel
        const panel = CalmPreviewPanel.createOrShowWithViewModel(ctx, uri, configService, log, this.vm)
        return panel
    }

    /**
     * Clear on dispose (legacy compatibility)
     */
    clearOnDispose() {
        // Panel cleanup is handled by CalmPreviewPanel singleton
    }

    dispose() {
        this.vm.dispose()
        this.disposables.forEach(d => d.dispose())
    }
}