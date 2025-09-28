import { Emitter } from '../../../../core/emitter'

/**
 * CalmModelViewModel - Framework-free ViewModel for CALM model tab
 * Manages model data display and filtering for JSON rendering
 */
export class CalmModelViewModel {
    private dataChangedEmitter = new Emitter<{ modelData: any; selectedId?: string }>()
    private selectionChangedEmitter = new Emitter<string | undefined>()
    private revealInEditorRequestEmitter = new Emitter<string>()

    private modelData: any = null
    private selectedId: string | undefined

    // Events
    onDataChanged = this.dataChangedEmitter.event
    onSelectionChanged = this.selectionChangedEmitter.event
    onRevealInEditorRequest = this.revealInEditorRequestEmitter.event

    /**
     * Set the model data to display
     */
    setModelData(data: any): void {
        this.modelData = data
        this.dataChangedEmitter.fire({ modelData: this.modelData, selectedId: this.selectedId })
    }

    /**
     * Get current model data
     */
    getModelData(): any {
        return this.modelData
    }

    /**
     * Set selected element ID
     */
    setSelectedId(id: string | undefined): void {
        if (this.selectedId !== id) {
            this.selectedId = id
            this.selectionChangedEmitter.fire(id)
            this.dataChangedEmitter.fire({ modelData: this.modelData, selectedId: this.selectedId })
        }
    }

    /**
     * Get selected element ID
     */
    getSelectedId(): string | undefined {
        return this.selectedId
    }

    /**
     * Request to reveal element in editor
     */
    revealInEditor(id: string): void {
        this.revealInEditorRequestEmitter.fire(id)
    }

    /**
     * Check if model has data
     */
    hasData(): boolean {
        return !!this.modelData
    }

    /**
     * Get state for debugging
     */
    getState() {
        return {
            hasData: this.hasData(),
            selectedId: this.selectedId
        }
    }

    /**
     * Reset all state
     */
    reset(): void {
        this.modelData = null
        this.selectedId = undefined

        this.dataChangedEmitter.fire({ modelData: null, selectedId: undefined })
        this.selectionChangedEmitter.fire(undefined)
    }

    /**
     * Dispose all emitters
     */
    dispose(): void {
        this.dataChangedEmitter.dispose()
        this.selectionChangedEmitter.dispose()
        this.revealInEditorRequestEmitter.dispose()
    }
}