import { Emitter } from '../../../../core/emitter'

/**
 * DocifyViewModel - Framework-free ViewModel for docify tab
 * Manages docify execution, results, and live mode
 */
export class DocifyViewModel {
    private docifyRequestEmitter = new Emitter<void>()
    private docifyResultEmitter = new Emitter<{ content: string; format: 'html' | 'markdown'; sourceFile: string }>()
    private docifyErrorEmitter = new Emitter<string>()
    private docifyStatusChangedEmitter = new Emitter<{ isRunning: boolean; isLiveMode: boolean }>()
    private liveModeChangedEmitter = new Emitter<boolean>()

    private docifyContent: string = ''
    private docifyFormat: 'html' | 'markdown' = 'markdown'
    private sourceFile: string = ''
    private isRunning: boolean = false
    private isLiveMode: boolean = false
    private lastError: string | undefined
    private autoRefreshTimer: NodeJS.Timeout | undefined

    // Events
    onDocifyRequest = this.docifyRequestEmitter.event
    onDocifyResult = this.docifyResultEmitter.event
    onDocifyError = this.docifyErrorEmitter.event
    onDocifyStatusChanged = this.docifyStatusChangedEmitter.event
    onLiveModeChanged = this.liveModeChangedEmitter.event

    /**
     * Set docify result content
     */
    setDocifyResult(content: string, format: 'html' | 'markdown', sourceFile: string): void {
        this.docifyContent = content
        this.docifyFormat = format
        this.sourceFile = sourceFile
        this.lastError = undefined

        this.setRunning(false)
        this.docifyResultEmitter.fire({ content, format, sourceFile })
    }

    /**
     * Get current docify content
     */
    getDocifyContent(): string {
        return this.docifyContent
    }

    /**
     * Get current docify format
     */
    getDocifyFormat(): 'html' | 'markdown' {
        return this.docifyFormat
    }

    /**
     * Get source file path
     */
    getSourceFile(): string {
        return this.sourceFile
    }

    /**
     * Set docify error
     */
    setDocifyError(error: string): void {
        this.lastError = error
        this.setRunning(false)
        this.docifyErrorEmitter.fire(error)
    }

    /**
     * Get last docify error
     */
    getLastError(): string | undefined {
        return this.lastError
    }

    /**
     * Set running status
     */
    setRunning(isRunning: boolean): void {
        if (this.isRunning !== isRunning) {
            this.isRunning = isRunning
            this.docifyStatusChangedEmitter.fire({ isRunning: this.isRunning, isLiveMode: this.isLiveMode })
        }
    }

    /**
     * Check if docify is currently running
     */
    getIsRunning(): boolean {
        return this.isRunning
    }

    /**
     * Set live mode status
     */
    setLiveMode(isLiveMode: boolean): void {
        if (this.isLiveMode !== isLiveMode) {
            this.isLiveMode = isLiveMode
            this.liveModeChangedEmitter.fire(isLiveMode)
            this.docifyStatusChangedEmitter.fire({ isRunning: this.isRunning, isLiveMode: this.isLiveMode })

            if (isLiveMode) {
                this.startAutoRefresh()
            } else {
                this.stopAutoRefresh()
            }
        }
    }

    /**
     * Check if in live mode
     */
    getIsLiveMode(): boolean {
        return this.isLiveMode
    }

    /**
     * Request docify execution
     */
    requestDocify(): void {
        if (!this.isRunning) {
            this.setRunning(true)
            this.docifyRequestEmitter.fire()
        }
    }

    /**
     * Start auto-refresh timer for live mode
     */
    private startAutoRefresh(): void {
        this.stopAutoRefresh() // Clear any existing timer

        // Auto-refresh every 2 seconds in live mode
        this.autoRefreshTimer = setInterval(() => {
            if (this.isLiveMode && !this.isRunning) {
                this.requestDocify()
            }
        }, 2000)
    }

    /**
     * Stop auto-refresh timer
     */
    private stopAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer)
            this.autoRefreshTimer = undefined
        }
    }

    /**
     * Toggle live mode
     */
    toggleLiveMode(): void {
        this.setLiveMode(!this.isLiveMode)
    }

    /**
     * Check if docify has content
     */
    hasContent(): boolean {
        return !!this.docifyContent
    }

    /**
     * Check if there was an error
     */
    hasError(): boolean {
        return !!this.lastError
    }

    /**
     * Get complete state for debugging
     */
    getState() {
        return {
            hasContent: this.hasContent(),
            hasError: this.hasError(),
            isRunning: this.isRunning,
            isLiveMode: this.isLiveMode,
            format: this.docifyFormat,
            contentLength: this.docifyContent.length,
            lastError: this.lastError
        }
    }

    /**
     * Clear docify content and errors
     */
    clear(): void {
        this.docifyContent = ''
        this.docifyFormat = 'markdown'
        this.sourceFile = ''
        this.lastError = undefined
        this.setRunning(false)

        this.docifyResultEmitter.fire({ content: '', format: 'markdown', sourceFile: '' })
    }

    /**
     * Reset all docify state
     */
    reset(): void {
        this.clear()
        this.setLiveMode(false)
    }

    /**
     * Dispose all emitters and stop timers
     */
    dispose(): void {
        this.stopAutoRefresh()
        this.docifyRequestEmitter.dispose()
        this.docifyResultEmitter.dispose()
        this.docifyErrorEmitter.dispose()
        this.docifyStatusChangedEmitter.dispose()
        this.liveModeChangedEmitter.dispose()
    }
}