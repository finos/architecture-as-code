import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DocifyViewModel } from './docify.view-model'

// Mock timers for testing
vi.useFakeTimers()

describe('DocifyViewModel', () => {
    let docifyViewModel: DocifyViewModel

    beforeEach(() => {
        docifyViewModel = new DocifyViewModel()
    })

    afterEach(() => {
        docifyViewModel.dispose()
        vi.clearAllTimers()
    })

    describe('initialization', () => {
        it('should create docify view model with default state', () => {
            expect(docifyViewModel).toBeDefined()
            expect(docifyViewModel instanceof DocifyViewModel).toBe(true)
            expect(docifyViewModel.getDocifyContent()).toBe('')
            expect(docifyViewModel.getDocifyFormat()).toBe('markdown')
            expect(docifyViewModel.getSourceFile()).toBe('')
            expect(docifyViewModel.getIsRunning()).toBe(false)
            expect(docifyViewModel.getIsLiveMode()).toBe(false)
            expect(docifyViewModel.getLastError()).toBeUndefined()
        })

        it('should have no content or errors initially', () => {
            expect(docifyViewModel.hasContent()).toBe(false)
            expect(docifyViewModel.hasError()).toBe(false)
        })
    })

    describe('docify content management', () => {
        it('should set and get docify result', () => {
            const mockContent = '# Test Content'
            const mockFormat = 'markdown' as const
            const mockSourceFile = '/path/to/test.calm'

            docifyViewModel.setDocifyResult(mockContent, mockFormat, mockSourceFile)

            expect(docifyViewModel.getDocifyContent()).toBe(mockContent)
            expect(docifyViewModel.getDocifyFormat()).toBe(mockFormat)
            expect(docifyViewModel.getSourceFile()).toBe(mockSourceFile)
            expect(docifyViewModel.hasContent()).toBe(true)
            expect(docifyViewModel.getIsRunning()).toBe(false)
            expect(docifyViewModel.getLastError()).toBeUndefined()
        })

        it('should set and get docify result with HTML format', () => {
            const mockContent = '<h1>Test Content</h1>'
            const mockFormat = 'html' as const
            const mockSourceFile = '/path/to/test.calm'

            docifyViewModel.setDocifyResult(mockContent, mockFormat, mockSourceFile)

            expect(docifyViewModel.getDocifyFormat()).toBe(mockFormat)
            expect(docifyViewModel.hasContent()).toBe(true)
        })

        it('should emit result event when setting docify result', () => {
            const resultSpy = vi.fn()
            docifyViewModel.onDocifyResult(resultSpy)

            const mockContent = '# Test'
            const mockFormat = 'markdown' as const
            const mockSourceFile = '/path/to/test.calm'

            docifyViewModel.setDocifyResult(mockContent, mockFormat, mockSourceFile)

            expect(resultSpy).toHaveBeenCalledWith({
                content: mockContent,
                format: mockFormat,
                sourceFile: mockSourceFile
            })
        })

        it('should clear content and reset state', () => {
            // Set some content first
            docifyViewModel.setDocifyResult('# Test', 'markdown', '/test.calm')
            expect(docifyViewModel.hasContent()).toBe(true)

            const resultSpy = vi.fn()
            docifyViewModel.onDocifyResult(resultSpy)

            docifyViewModel.clear()

            expect(docifyViewModel.getDocifyContent()).toBe('')
            expect(docifyViewModel.getDocifyFormat()).toBe('markdown')
            expect(docifyViewModel.getSourceFile()).toBe('')
            expect(docifyViewModel.hasContent()).toBe(false)
            expect(docifyViewModel.getIsRunning()).toBe(false)
            expect(resultSpy).toHaveBeenCalledWith({
                content: '',
                format: 'markdown',
                sourceFile: ''
            })
        })
    })

    describe('error handling', () => {
        it('should set and get docify error', () => {
            const mockError = 'Test error message'

            docifyViewModel.setDocifyError(mockError)

            expect(docifyViewModel.getLastError()).toBe(mockError)
            expect(docifyViewModel.hasError()).toBe(true)
            expect(docifyViewModel.getIsRunning()).toBe(false)
        })

        it('should emit error event when setting docify error', () => {
            const errorSpy = vi.fn()
            docifyViewModel.onDocifyError(errorSpy)

            const mockError = 'Test error message'
            docifyViewModel.setDocifyError(mockError)

            expect(errorSpy).toHaveBeenCalledWith(mockError)
        })

        it('should clear error when setting successful result', () => {
            // Set error first
            docifyViewModel.setDocifyError('Test error')
            expect(docifyViewModel.hasError()).toBe(true)

            // Set successful result
            docifyViewModel.setDocifyResult('Success!', 'markdown', '/test.calm')

            expect(docifyViewModel.getLastError()).toBeUndefined()
            expect(docifyViewModel.hasError()).toBe(false)
        })
    })

    describe('running state management', () => {
        it('should set and get running state', () => {
            expect(docifyViewModel.getIsRunning()).toBe(false)

            docifyViewModel.setRunning(true)
            expect(docifyViewModel.getIsRunning()).toBe(true)

            docifyViewModel.setRunning(false)
            expect(docifyViewModel.getIsRunning()).toBe(false)
        })

        it('should emit status changed event when running state changes', () => {
            const statusSpy = vi.fn()
            docifyViewModel.onDocifyStatusChanged(statusSpy)

            docifyViewModel.setRunning(true)

            expect(statusSpy).toHaveBeenCalledWith({
                isRunning: true,
                isLiveMode: false
            })
        })

        it('should not emit status changed event when running state is the same', () => {
            docifyViewModel.setRunning(false) // Already false

            const statusSpy = vi.fn()
            docifyViewModel.onDocifyStatusChanged(statusSpy)

            docifyViewModel.setRunning(false) // Same value

            expect(statusSpy).not.toHaveBeenCalled()
        })
    })

    describe('live mode', () => {
        it('should set and get live mode state', () => {
            expect(docifyViewModel.getIsLiveMode()).toBe(false)

            docifyViewModel.setLiveMode(true)
            expect(docifyViewModel.getIsLiveMode()).toBe(true)

            docifyViewModel.setLiveMode(false)
            expect(docifyViewModel.getIsLiveMode()).toBe(false)
        })

        it('should toggle live mode', () => {
            expect(docifyViewModel.getIsLiveMode()).toBe(false)

            docifyViewModel.toggleLiveMode()
            expect(docifyViewModel.getIsLiveMode()).toBe(true)

            docifyViewModel.toggleLiveMode()
            expect(docifyViewModel.getIsLiveMode()).toBe(false)
        })

        it('should emit live mode changed event', () => {
            const liveModeSpy = vi.fn()
            docifyViewModel.onLiveModeChanged(liveModeSpy)

            docifyViewModel.setLiveMode(true)

            expect(liveModeSpy).toHaveBeenCalledWith(true)
        })

        it('should emit status changed event when live mode changes', () => {
            const statusSpy = vi.fn()
            docifyViewModel.onDocifyStatusChanged(statusSpy)

            docifyViewModel.setLiveMode(true)

            expect(statusSpy).toHaveBeenCalledWith({
                isRunning: false,
                isLiveMode: true
            })
        })

        it('should not emit events when live mode is the same', () => {
            docifyViewModel.setLiveMode(false) // Already false

            const liveModeSpy = vi.fn()
            const statusSpy = vi.fn()
            docifyViewModel.onLiveModeChanged(liveModeSpy)
            docifyViewModel.onDocifyStatusChanged(statusSpy)

            docifyViewModel.setLiveMode(false) // Same value

            expect(liveModeSpy).not.toHaveBeenCalled()
            expect(statusSpy).not.toHaveBeenCalled()
        })
    })

    describe('auto-refresh in live mode', () => {
        it('should start auto-refresh when live mode is enabled', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            docifyViewModel.setLiveMode(true)

            // Fast-forward timer by 2 seconds
            vi.advanceTimersByTime(2000)

            expect(requestSpy).toHaveBeenCalledOnce()
        })

        it('should continue auto-refresh every 2 seconds in live mode', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            docifyViewModel.setLiveMode(true)

            // First interval
            vi.advanceTimersByTime(2000)
            expect(requestSpy).toHaveBeenCalledTimes(1)

            // Simulate completing the first request
            docifyViewModel.setRunning(false)

            // Second interval
            vi.advanceTimersByTime(2000)
            expect(requestSpy).toHaveBeenCalledTimes(2)

            // Simulate completing the second request
            docifyViewModel.setRunning(false)

            // Third interval
            vi.advanceTimersByTime(2000)
            expect(requestSpy).toHaveBeenCalledTimes(3)
        })

        it('should stop auto-refresh when live mode is disabled', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            // Enable live mode
            docifyViewModel.setLiveMode(true)
            vi.advanceTimersByTime(2000)
            expect(requestSpy).toHaveBeenCalledOnce()

            // Disable live mode
            docifyViewModel.setLiveMode(false)
            requestSpy.mockClear()

            // Fast-forward more time
            vi.advanceTimersByTime(4000)

            expect(requestSpy).not.toHaveBeenCalled()
        })

        it('should not auto-refresh when docify is already running', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            docifyViewModel.setLiveMode(true)
            docifyViewModel.setRunning(true) // Set running state

            // Fast-forward timer
            vi.advanceTimersByTime(2000)

            expect(requestSpy).not.toHaveBeenCalled()
        })
    })

    describe('docify request handling', () => {
        it('should request docify execution when not running', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            docifyViewModel.requestDocify()

            expect(requestSpy).toHaveBeenCalledOnce()
            expect(docifyViewModel.getIsRunning()).toBe(true)
        })

        it('should not request docify execution when already running', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            docifyViewModel.setRunning(true)
            docifyViewModel.requestDocify()

            expect(requestSpy).not.toHaveBeenCalled()
        })
    })

    describe('state management', () => {
        it('should get complete state for debugging', () => {
            docifyViewModel.setDocifyResult('# Test', 'html', '/test.calm')
            docifyViewModel.setLiveMode(true)

            const state = docifyViewModel.getState()

            expect(state).toEqual({
                hasContent: true,
                hasError: false,
                isRunning: false,
                isLiveMode: true,
                format: 'html',
                contentLength: 6,
                lastError: undefined
            })
        })

        it('should reset all state', () => {
            // Set some state
            docifyViewModel.setDocifyResult('# Test', 'html', '/test.calm')
            docifyViewModel.setLiveMode(true)
            docifyViewModel.setDocifyError('Some error')

            const resultSpy = vi.fn()
            docifyViewModel.onDocifyResult(resultSpy)

            docifyViewModel.reset()

            expect(docifyViewModel.getDocifyContent()).toBe('')
            expect(docifyViewModel.getDocifyFormat()).toBe('markdown')
            expect(docifyViewModel.getSourceFile()).toBe('')
            expect(docifyViewModel.getIsLiveMode()).toBe(false)
            expect(docifyViewModel.getIsRunning()).toBe(false)
            expect(docifyViewModel.getLastError()).toBeUndefined()
            expect(resultSpy).toHaveBeenCalledWith({
                content: '',
                format: 'markdown',
                sourceFile: ''
            })
        })
    })

    describe('disposal', () => {
        it('should dispose without errors', () => {
            expect(() => docifyViewModel.dispose()).not.toThrow()
        })

        it('should stop auto-refresh timer on disposal', () => {
            const requestSpy = vi.fn()
            docifyViewModel.onDocifyRequest(requestSpy)

            // Enable live mode to start timer
            docifyViewModel.setLiveMode(true)

            // Dispose the view model
            docifyViewModel.dispose()

            // Fast-forward time
            vi.advanceTimersByTime(4000)

            // Timer should be stopped
            expect(requestSpy).not.toHaveBeenCalled()
        })

        it('should dispose all emitters', () => {
            // This test ensures dispose doesn't throw and cleans up properly
            const requestSpy = vi.fn()
            const resultSpy = vi.fn()
            const errorSpy = vi.fn()
            const statusSpy = vi.fn()
            const liveModeSpy = vi.fn()

            docifyViewModel.onDocifyRequest(requestSpy)
            docifyViewModel.onDocifyResult(resultSpy)
            docifyViewModel.onDocifyError(errorSpy)
            docifyViewModel.onDocifyStatusChanged(statusSpy)
            docifyViewModel.onLiveModeChanged(liveModeSpy)

            expect(() => docifyViewModel.dispose()).not.toThrow()

            // After disposal, events should not be fired
            docifyViewModel.setDocifyResult('test', 'markdown', 'file')
            docifyViewModel.setDocifyError('error')
            docifyViewModel.setRunning(true)
            docifyViewModel.setLiveMode(true)
            docifyViewModel.requestDocify()

            // Events should not be called after disposal (emitters disposed)
            expect(requestSpy).not.toHaveBeenCalled()
        })
    })
})