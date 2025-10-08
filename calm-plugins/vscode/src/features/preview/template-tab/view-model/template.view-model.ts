import { Emitter } from '../../../../core/emitter'

/**
 * TemplateViewModel - Framework-free ViewModel for template tab
 * Manages template content, template mode, and template-specific operations
 */
export class TemplateViewModel {
    private templateContentChangedEmitter = new Emitter<{ content: string; name: string; selectedId: string; isTemplateMode: boolean }>()
    private templateModeChangedEmitter = new Emitter<{ isTemplateMode: boolean; templatePath?: string; architecturePath?: string }>()
    private templateDataRequestEmitter = new Emitter<void>()
    private showLabelsChangedEmitter = new Emitter<boolean>()

    private templateContent: string = ''
    private templateName: string = ''
    private isTemplateMode: boolean = false
    private templateFilePath: string | undefined
    private architectureFilePath: string | undefined
    private showLabels: boolean = true
    private selectedId: string = 'none'

    // Events
    onTemplateContentChanged = this.templateContentChangedEmitter.event
    onTemplateModeChanged = this.templateModeChangedEmitter.event
    onTemplateDataRequest = this.templateDataRequestEmitter.event
    onShowLabelsChanged = this.showLabelsChangedEmitter.event

    /**
     * Set template content and metadata
     */
    setTemplateContent(content: string, name: string, selectedId: string, isTemplateMode: boolean): void {
        this.templateContent = content
        this.templateName = name
        this.selectedId = selectedId
        this.isTemplateMode = isTemplateMode

        this.templateContentChangedEmitter.fire({
            content: this.templateContent,
            name: this.templateName,
            selectedId: this.selectedId,
            isTemplateMode: this.isTemplateMode
        })
    }

    /**
     * Get current template content
     */
    getTemplateContent(): string {
        return this.templateContent
    }

    /**
     * Get current template name
     */
    getTemplateName(): string {
        return this.templateName
    }

    /**
     * Set template mode state
     */
    setTemplateMode(isTemplateMode: boolean, templatePath?: string, architecturePath?: string): void {
        this.isTemplateMode = isTemplateMode
        this.templateFilePath = templatePath
        this.architectureFilePath = architecturePath

        this.templateModeChangedEmitter.fire({
            isTemplateMode: this.isTemplateMode,
            templatePath: this.templateFilePath,
            architecturePath: this.architectureFilePath
        })

        // Auto-request template data when mode changes
        if (isTemplateMode) {
            this.requestTemplateData()
        }
    }

    /**
     * Check if currently in template mode
     */
    getIsTemplateMode(): boolean {
        return this.isTemplateMode
    }

    /**
     * Get template file path
     */
    getTemplateFilePath(): string | undefined {
        return this.templateFilePath
    }

    /**
     * Get architecture file path for template mode
     */
    getArchitectureFilePath(): string | undefined {
        return this.architectureFilePath
    }

    /**
     * Set show labels preference
     */
    setShowLabels(showLabels: boolean): void {
        this.showLabels = showLabels
        this.showLabelsChangedEmitter.fire(showLabels)

        // Auto-refresh template when labels toggle
        this.requestTemplateData()
    }

    /**
     * Get show labels preference
     */
    getShowLabels(): boolean {
        return this.showLabels
    }

    /**
     * Set selected element ID for template context
     */
    setSelectedId(selectedId: string): void {
        this.selectedId = selectedId || 'none'
        // Auto-refresh template when selection changes
        this.requestTemplateData()
    }

    /**
     * Get selected element ID
     */
    getSelectedId(): string {
        return this.selectedId
    }

    /**
     * Request template data refresh
     */
    requestTemplateData(): void {
        this.templateDataRequestEmitter.fire()
    }

    /**
     * Check if template has content
     */
    hasContent(): boolean {
        return !!this.templateContent
    }

    /**
     * Get complete state for debugging
     */
    getState() {
        return {
            hasContent: this.hasContent(),
            templateName: this.templateName,
            isTemplateMode: this.isTemplateMode,
            selectedId: this.selectedId,
            showLabels: this.showLabels,
            hasTemplatePath: !!this.templateFilePath,
            hasArchitecturePath: !!this.architectureFilePath
        }
    }

    /**
     * Reset all template state
     */
    reset(): void {
        this.templateContent = ''
        this.templateName = ''
        this.isTemplateMode = false
        this.templateFilePath = undefined
        this.architectureFilePath = undefined
        this.selectedId = 'none'

        this.templateContentChangedEmitter.fire({
            content: '',
            name: '',
            selectedId: 'none',
            isTemplateMode: false
        })

        this.templateModeChangedEmitter.fire({
            isTemplateMode: false,
            templatePath: undefined,
            architecturePath: undefined
        })
    }

    /**
     * Dispose all emitters
     */
    dispose(): void {
        this.templateContentChangedEmitter.dispose()
        this.templateModeChangedEmitter.dispose()
        this.templateDataRequestEmitter.dispose()
        this.showLabelsChangedEmitter.dispose()
    }
}