import type { ApplicationStoreApi } from '../../../application-store'

/**
 * Framework-free ViewModel for editor features
 * Handles editor-related presentation logic without VSCode dependencies
 */
export class EditorViewModel {
    private unsubscribers: Array<() => void> = []

    constructor(private store: ApplicationStoreApi) {
        // Subscribe to store changes if needed
        // Currently editor features are mostly reactive to user actions
    }

    /**
     * Get the range for a given ID in the current model
     */
    getRangeForId(id: string): any {
        const state = this.store.getState()
        const modelIndex = state.currentModelIndex
        if (!modelIndex) return undefined
        return (modelIndex as any).rangeOf(id)
    }

    /**
     * Get the current model index
     */
    getCurrentModelIndex(): any {
        return this.store.getState().currentModelIndex
    }

    /**
     * Check if we're in template mode
     */
    isTemplateMode(): boolean {
        return this.store.getState().isTemplateMode
    }

    /**
     * Get ID at a specific document position
     */
    getIdAtPosition(doc: any, position: any): string | undefined {
        const modelIndex = this.getCurrentModelIndex()
        if (!modelIndex) return undefined
        return (modelIndex as any).idAt?.(doc, position)
    }

    /**
     * Update selected element in store
     */
    setSelectedElement(id: string): void {
        this.store.getState().setSelectedElement(id)
    }

    /**
     * Get current selected element
     */
    getSelectedElement(): string {
        return this.store.getState().selectedElementId || ''
    }

    dispose(): void {
        this.unsubscribers.forEach(unsub => unsub())
        this.unsubscribers = []
    }
}