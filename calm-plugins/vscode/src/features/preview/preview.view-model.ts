import { Emitter } from '../../core/emitter'
import { CalmModelViewModel } from './model-tab/view-model/calm-model.view-model'
import { TemplateViewModel } from './template-tab/view-model/template.view-model'
import { DocifyViewModel } from './docify-tab/view-model/docify.view-model'

// Legacy compatibility import - only used for backward compatibility methods
// TODO: Remove when all consumers use framework-agnostic interface
import * as vscode from 'vscode'
import {GraphData, LastData} from "../../models/model";

/**
 * Interface that external services should use to interact with preview
 * This replaces the PreviewLike interface that was in PreviewPanelFactory
 * Framework-agnostic - uses strings instead of VS Code types
 */
export interface PreviewViewModelInterface {
    setData(data: { graph: GraphData; selectedId?: string }): void
    postSelect(id: string): void
    getCurrentUriPath(): string | undefined
    revealFile(filePath: string): void
    onRevealInEditor(handler: (id: string) => void): void
    onDidSelect(handler: (id: string) => void): void
    setGetCurrentTreeSelection(fn: () => string | undefined): void
}

/**
 * PreviewViewModel - Main orchestrator for preview panel MVVM
 * Manages tab selection, version announcements, and coordinates child ViewModels
 * Now implements PreviewViewModelInterface for external service interactions
 */
export class PreviewViewModel implements PreviewViewModelInterface {
    // Child ViewModels
    public readonly calmModel = new CalmModelViewModel()
    public readonly template = new TemplateViewModel()
    public readonly docify = new DocifyViewModel()

    // Main orchestration emitters
    private activeTabChangedEmitter = new Emitter<'model' | 'template' | 'docify'>()
    private readyStateChangedEmitter = new Emitter<boolean>()
    private visibilityChangedEmitter = new Emitter<boolean>()
    private versionAnnouncementEmitter = new Emitter<{ version: string; message: string }>()
    private stateChangedEmitter = new Emitter<void>()
    private modelDataRequestEmitter = new Emitter<void>()
    private templateDataRequestEmitter = new Emitter<void>()
    private docifyRequestEmitter = new Emitter<void>()

    // Event handlers for external services
    private revealInEditorHandlers: Array<(id: string) => void> = []
    private selectHandlers: Array<(id: string) => void> = []
    private getCurrentTreeSelectionFn: (() => string | undefined) | undefined

    // Core state
    private activeTab: 'model' | 'template' | 'docify' = 'model'
    private isVisible = false
    private isReady = false
    private currentUri: string | undefined
    private extensionVersion: string = ''

    // Events
    onActiveTabChanged = this.activeTabChangedEmitter.event
    onReadyStateChanged = this.readyStateChangedEmitter.event
    onVisibilityChanged = this.visibilityChangedEmitter.event
    onVersionAnnouncement = this.versionAnnouncementEmitter.event
    onStateChanged = this.stateChangedEmitter.event
    onModelDataRequest = this.modelDataRequestEmitter.event
    onTemplateDataRequest = this.templateDataRequestEmitter.event
    onDocifyRequest = this.docifyRequestEmitter.event

    constructor() {
        this.bindChildViewModels()
    }

    /**
     * Notify that preview state has changed
     */
    private notifyStateChanged(): void {
        this.stateChangedEmitter.fire()
    }

    /**
     * Bind child ViewModel events to coordinate between tabs
     */
    private bindChildViewModels(): void {
        // When model selection changes, update template and potentially trigger docify
        this.calmModel.onSelectionChanged((selectedId) => {
            this.template.setSelectedId(selectedId || 'none')
            this.notifyStateChanged()

            // Auto-trigger docify in live mode
            if (this.docify.getIsLiveMode()) {
                this.docify.requestDocify()
            }
        })

        // When template mode changes, coordinate with child ViewModels
        this.template.onTemplateModeChanged((modeData) => {
            this.notifyStateChanged()
            // Template mode affects model data loading
            if (modeData.isTemplateMode && this.calmModel.hasData()) {
                // Might need to reload model data for template architecture file
            }
        })

        // When labels toggle, may affect docify output
        this.template.onShowLabelsChanged((showLabels) => {
            this.notifyStateChanged()
            if (this.docify.getIsLiveMode()) {
                this.docify.requestDocify()
            }
        })

        // Auto-switch to docify tab when docify completes
        this.docify.onDocifyResult(() => {
            if (this.activeTab !== 'docify') {
                this.setActiveTab('docify')
            }
        })

        // Show error and switch to docify tab on error
        this.docify.onDocifyError(() => {
            if (this.activeTab !== 'docify') {
                this.setActiveTab('docify')
            }
        })

        // Forward child ViewModel requests to main emitters
        this.template.onTemplateDataRequest(() => {
            this.templateDataRequestEmitter.fire()
        })

        this.docify.onDocifyRequest(() => {
            this.docifyRequestEmitter.fire()
        })

        // Listen for data changes to trigger state notifications
        this.calmModel.onDataChanged(() => {
            this.notifyStateChanged()
        })
    }

    /**
     * Set the active tab
     */
    setActiveTab(tab: 'model' | 'template' | 'docify'): void {
        if (this.activeTab !== tab) {
            this.activeTab = tab
            this.activeTabChangedEmitter.fire(tab)
        }
    }

    /**
     * Get the active tab
     */
    getActiveTab(): 'model' | 'template' | 'docify' {
        return this.activeTab
    }

    /**
     * Set panel visibility
     */
    setVisible(visible: boolean): void {
        if (this.isVisible !== visible) {
            this.isVisible = visible
            this.visibilityChangedEmitter.fire(visible)
        }
    }

    /**
     * Get panel visibility
     */
    getVisible(): boolean {
        return this.isVisible
    }

    /**
     * Set ready state
     */
    setReady(ready: boolean): void {
        if (this.isReady !== ready) {
            this.isReady = ready
            this.readyStateChangedEmitter.fire(ready)
            this.notifyStateChanged() // Notify that state changed when ready state changes
        }
    }

    /**
     * Get ready state
     */
    getIsReady(): boolean {
        return this.isReady
    }

    /**
     * Set current URI
     */
    setCurrentUri(uri: string): void {
        const previousUri = this.currentUri
        this.currentUri = uri

        if (previousUri && previousUri !== uri) {
            // Reset all child ViewModels when file changes
            this.calmModel.reset()
            this.template.reset()
            this.docify.reset()
        }
    }

    /**
     * Set extension version for announcements
     */
    setExtensionVersion(version: string): void {
        this.extensionVersion = version
    }

    /**
     * Show version announcement
     */
    announceVersion(message: string): void {
        this.versionAnnouncementEmitter.fire({
            version: this.extensionVersion,
            message
        })
    }

    /**
     * Set template mode across relevant ViewModels
     */
    setTemplateMode(isTemplateMode: boolean, templatePath?: string, architecturePath?: string): void {
        this.template.setTemplateMode(isTemplateMode, templatePath, architecturePath)

        // Auto-switch to template tab when entering template mode
        if (isTemplateMode && this.activeTab === 'model') {
            this.setActiveTab('template')
        }
    }

    /**
     * Set data across relevant ViewModels
     */
    setData(data: { graph: GraphData; selectedId?: string }): void {
        // Set model data
        this.calmModel.setModelData(data.graph)

        if (data.selectedId) {
            this.calmModel.setSelectedId(data.selectedId)
        }
    }

    /**
     * Get combined data from child ViewModels
     */
    getData(): LastData | undefined {
        if (!this.calmModel.hasData()) {
            return undefined
        }

        return {
            graph: this.calmModel.getModelData(),
            selectedId: this.calmModel.getSelectedId()
        }
    }

    /**
     * Get complete preview state for debugging
     */
    getPreviewState() {
        return {
            isVisible: this.isVisible,
            isReady: this.isReady,
            activeTab: this.activeTab,
            currentUri: this.currentUri,
            extensionVersion: this.extensionVersion,

            // Legacy properties expected by preview panel
            ready: this.isReady,
            hasData: this.calmModel.hasData(),
            selectedId: this.calmModel.getSelectedId(),

            // Template-related legacy properties
            isTemplateMode: this.template.getIsTemplateMode(),
            templateFilePath: this.template.getTemplateFilePath(),
            architectureFilePath: this.template.getArchitectureFilePath(),
            showLabels: this.template.getShowLabels(),

            // Child ViewModel states  
            model: this.calmModel.getState(),
            template: this.template.getState(),
            docify: this.docify.getState()
        }
    }

    /**
     * Legacy compatibility methods for existing preview panel
     */

    // Legacy template mode methods
    getTemplateMode(): boolean {
        return this.template.getIsTemplateMode()
    }

    getTemplateFilePath(): string | undefined {
        return this.template.getTemplateFilePath()
    }

    getArchitectureFilePath(): string | undefined {
        return this.template.getArchitectureFilePath()
    }

    getShowLabels(): boolean {
        return this.template.getShowLabels()
    }

    getSelectedId(): string | undefined {
        return this.calmModel.getSelectedId()
    }

    // Legacy setter method for selected ID
    setSelectedId(id: string | undefined): void {
        this.calmModel.setSelectedId(id)
    }

    // Legacy event handlers
    handleRevealInEditor(id: string): void {
        this.calmModel.revealInEditor(id)
    }

    handleSelected(id: string): void {
        this.calmModel.setSelectedId(id)
    }

    handleReady(): void {
        this.setReady(true)
    }

    handleToggleLabels(showLabels: boolean): void {
        this.template.setShowLabels(showLabels)
    }

    handleRunDocify(): void {
        this.docify.requestDocify()
    }

    handleRequestModelData(): void {
        this.modelDataRequestEmitter.fire()
    }

    handleRequestTemplateData(): void {
        this.template.requestTemplateData()
    }

    /**
     * Dispose all ViewModels and emitters
     */
    dispose(): void {
        this.calmModel.dispose()
        this.template.dispose()
        this.docify.dispose()
        this.activeTabChangedEmitter.dispose()
        this.readyStateChangedEmitter.dispose()
        this.visibilityChangedEmitter.dispose()
        this.versionAnnouncementEmitter.dispose()
        this.stateChangedEmitter.dispose()
        this.modelDataRequestEmitter.dispose()
        this.templateDataRequestEmitter.dispose()
        this.docifyRequestEmitter.dispose()
    }

    // ======== PreviewViewModelInterface Implementation (Framework-Agnostic) ========

    /**
     * Handle selection from external services (tree, etc.)
     */
    postSelect(id: string): void {
        this.setSelectedId(id)
        this.selectHandlers.forEach(h => h(id))
    }

    /**
     * Reveal a file in the preview (framework-agnostic)
     */
    revealFile(filePath: string): void {
        this.setCurrentUri(filePath)
        // Notify state changed to trigger appropriate data loading
        this.notifyStateChanged()
    }

    /**
     * Get current URI path as string (framework-agnostic)
     */
    getCurrentUriPath(): string | undefined {
        return this.currentUri
    }

    /**
     * Get current URI as string (for internal use - alias for getCurrentUriPath)
     */
    getCurrentUriString(): string | undefined {
        return this.currentUri
    }

    /**
     * Register handler for reveal in editor events
     */
    onRevealInEditor(handler: (id: string) => void): void {
        this.revealInEditorHandlers.push(handler)
    }

    /**
     * Register handler for selection events
     */
    onDidSelect(handler: (id: string) => void): void {
        this.selectHandlers.push(handler)
    }

    /**
     * Set tree selection getter function
     */
    setGetCurrentTreeSelection(fn: () => string | undefined): void {
        this.getCurrentTreeSelectionFn = fn
    }

    /**
     * Get current tree selection (for docify service)
     */
    getCurrentTreeSelection(): string | undefined {
        return this.getCurrentTreeSelectionFn?.()
    }

    // ======== Legacy Compatibility Methods (VS Code Specific) ========
    // TODO: Remove these when all consumers migrate to framework-agnostic interface

    /**
     * Get current URI as vscode.Uri (for legacy CalmPreviewPanel compatibility)
     */
    getCurrentUri(): vscode.Uri | undefined {
        return this.currentUri ? vscode.Uri.file(this.currentUri) : undefined
    }

    /**
     * Reveal a file using vscode.Uri (legacy compatibility for CalmPreviewPanel)
     */
    reveal(uri: vscode.Uri): void {
        this.revealFile(uri.fsPath)
    }
}
