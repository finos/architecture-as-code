import { debounce } from 'lodash'
import type { GraphData, LastData } from '../../preview/types'

/**
 * PreviewViewModel - MVVM pattern for preview panel presentation logic
 * Manages preview state, template mode, docify operations without VSCode dependencies
 */
export class PreviewViewModel {
    private isVisible = false
    private currentUri: string | undefined
    private isTemplateMode = false
    private templateFilePath: string | undefined
    private architectureFilePath: string | undefined
    private showLabels = true
    private selectedId: string | undefined
    private lastData: LastData
    private ready = false

    // Observable callbacks
    private onVisibilityChangedCallbacks = new Set<(visible: boolean) => void>()
    private onTemplateDataRequestCallbacks = new Set<() => void>()
    private onModelDataRequestCallbacks = new Set<() => void>()
    private onDocifyRequestCallbacks = new Set<() => void>()
    private onStateChangedCallbacks = new Set<() => void>()

    constructor() {
        // Debounced docify to avoid excessive processing
        this.debouncedRequestDocify = debounce(() => {
            this.onDocifyRequestCallbacks.forEach(callback => callback())
        }, 120)
    }

    private debouncedRequestDocify: () => void

    // Observable pattern for UI updates
    onVisibilityChanged(callback: (visible: boolean) => void): void {
        this.onVisibilityChangedCallbacks.add(callback)
    }

    onTemplateDataRequest(callback: () => void): void {
        this.onTemplateDataRequestCallbacks.add(callback)
    }

    onModelDataRequest(callback: () => void): void {
        this.onModelDataRequestCallbacks.add(callback)
    }

    onDocifyRequest(callback: () => void): void {
        this.onDocifyRequestCallbacks.add(callback)
    }

    onStateChanged(callback: () => void): void {
        this.onStateChangedCallbacks.add(callback)
    }

    private notifyStateChanged(): void {
        this.onStateChangedCallbacks.forEach(callback => callback())
    }

    // Visibility management
    setVisible(visible: boolean): void {
        if (this.isVisible !== visible) {
            this.isVisible = visible
            this.onVisibilityChangedCallbacks.forEach(callback => callback(visible))
        }
    }

    getVisible(): boolean {
        return this.isVisible
    }

    // URI management
    setCurrentUri(uri: string): void {
        const previousUri = this.currentUri
        this.currentUri = uri

        if (previousUri && previousUri !== uri) {
            this.selectedId = undefined
            this.notifyStateChanged()
        }
    }

    getCurrentUri(): string | undefined {
        return this.currentUri
    }

    // Template mode management
    setTemplateMode(isTemplateMode: boolean, templatePath?: string, architecturePath?: string): void {
        this.isTemplateMode = isTemplateMode
        this.templateFilePath = templatePath
        this.architectureFilePath = architecturePath
        this.notifyStateChanged()

        if (isTemplateMode) {
            this.onTemplateDataRequestCallbacks.forEach(callback => callback())
        }
    }

    getTemplateMode(): boolean {
        return this.isTemplateMode
    }

    getTemplateFilePath(): string | undefined {
        return this.templateFilePath
    }

    getArchitectureFilePath(): string | undefined {
        return this.architectureFilePath
    }

    // Selection management
    setSelectedId(id: string | undefined): void {
        this.selectedId = id
        this.notifyStateChanged()

        // Auto-refresh docify when selection changes
        this.debouncedRequestDocify()
    }

    getSelectedId(): string | undefined {
        return this.selectedId
    }

    // Label settings
    setShowLabels(showLabels: boolean): void {
        this.showLabels = showLabels
        this.notifyStateChanged()

        if (this.isTemplateMode) {
            this.onTemplateDataRequestCallbacks.forEach(callback => callback())
        } else if (this.ready) {
            this.debouncedRequestDocify()
        }
    }

    getShowLabels(): boolean {
        return this.showLabels
    }

    // Data management
    setData(data: { graph: GraphData; selectedId?: string; settings?: unknown; positions?: unknown; viewport?: unknown }): void {
        this.lastData = data
        this.notifyStateChanged()

        if (this.isTemplateMode && this.ready) {
            this.onTemplateDataRequestCallbacks.forEach(callback => callback())
        }
    }

    getData(): LastData {
        return this.lastData
    }

    // Ready state
    setReady(ready: boolean): void {
        this.ready = ready
        if (ready && this.lastData) {
            this.notifyStateChanged()
        }
    }

    isReady(): boolean {
        return this.ready
    }

    // Request handlers (trigger callbacks)
    requestModelData(): void {
        this.onModelDataRequestCallbacks.forEach(callback => callback())
    }

    requestTemplateData(): void {
        this.onTemplateDataRequestCallbacks.forEach(callback => callback())
    }

    requestDocify(): void {
        this.debouncedRequestDocify()
    }

    // State for UI
    getPreviewState() {
        return {
            isVisible: this.isVisible,
            currentUri: this.currentUri,
            isTemplateMode: this.isTemplateMode,
            templateFilePath: this.templateFilePath,
            architectureFilePath: this.architectureFilePath,
            showLabels: this.showLabels,
            selectedId: this.selectedId,
            ready: this.ready,
            hasData: !!this.lastData
        }
    }

    // Methods for webview message handling
    handleRevealInEditor(id: string): void {
        // This will be handled by the UI layer
        this.notifyStateChanged()
    }

    handleSelected(id: string): void {
        this.setSelectedId(id)
    }

    handleReady(): void {
        this.setReady(true)
    }

    handleSavePositions(positions: unknown): void {
        if (this.lastData) {
            this.lastData = { ...this.lastData, positions: positions as any }
        }
    }

    handleSaveViewport(viewport: unknown): void {
        if (this.lastData) {
            this.lastData = { ...this.lastData, viewport: viewport as any }
        }
    }

    handleToggleLabels(showLabels: boolean): void {
        this.setShowLabels(showLabels)
    }

    handleRunDocify(): void {
        this.requestDocify()
    }

    handleRequestModelData(): void {
        this.requestModelData()
    }

    handleRequestTemplateData(): void {
        this.requestTemplateData()
    }
}
