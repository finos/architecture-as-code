import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PreviewViewModel } from './preview.view-model'

// Mock vscode API (required by preview.view-model.ts for legacy compatibility methods)
vi.mock('vscode', () => ({
    Uri: {
        file: vi.fn((path: string) => ({
            fsPath: path,
            toString: () => `file://${path}`,
        })),
    },
}))

// Mock timers for testing debounced operations
vi.useFakeTimers()

describe('PreviewViewModel', () => {
    let previewViewModel: PreviewViewModel

    beforeEach(() => {
        previewViewModel = new PreviewViewModel()
    })

    afterEach(() => {
        previewViewModel.dispose()
        vi.clearAllTimers()
    })

    describe('initialization', () => {
        it('should create preview view model with default state', () => {
            expect(previewViewModel).toBeDefined()
            expect(previewViewModel instanceof PreviewViewModel).toBe(true)

            const state = previewViewModel.getPreviewState()
            expect(state.isVisible).toBe(false)
            expect(state.isReady).toBe(false)
            expect(state.activeTab).toBe('model')
        })

        it('should initialize child view models', () => {
            expect(previewViewModel.calmModel).toBeDefined()
            expect(previewViewModel.template).toBeDefined()
            expect(previewViewModel.docify).toBeDefined()
        })
    })

    describe('configurationChanged', () => {
        it('should not trigger docify refresh when model tab is active', async () => {
            const docifyRequestSpy = vi.fn()
            previewViewModel.docify.onDocifyRequest(docifyRequestSpy)

            // Ensure we're on model tab
            previewViewModel.setActiveTab('model')

            // Call configuration changed
            previewViewModel.configurationChanged()

            // Wait for any debounced operations
            await vi.runAllTimersAsync()

            // Should not trigger docify
            expect(docifyRequestSpy).not.toHaveBeenCalled()
        })

        it('should not trigger docify refresh when template tab is active', async () => {
            const docifyRequestSpy = vi.fn()
            previewViewModel.docify.onDocifyRequest(docifyRequestSpy)

            // Switch to template tab
            previewViewModel.setActiveTab('template')

            // Call configuration changed
            previewViewModel.configurationChanged()

            // Wait for any debounced operations
            await vi.runAllTimersAsync()

            // Should not trigger docify
            expect(docifyRequestSpy).not.toHaveBeenCalled()
        })

        it('should trigger docify refresh when docify tab is active', async () => {
            const docifyRequestSpy = vi.fn()
            previewViewModel.docify.onDocifyRequest(docifyRequestSpy)

            // Switch to docify tab
            previewViewModel.setActiveTab('docify')

            // Call configuration changed
            previewViewModel.configurationChanged()

            // Wait for debounced docify request
            await vi.runAllTimersAsync()

            // Should trigger docify refresh
            expect(docifyRequestSpy).toHaveBeenCalledTimes(1)
        })

        it('should only refresh docify once per call after debounce', async () => {
            const docifyRequestSpy = vi.fn()
            previewViewModel.docify.onDocifyRequest(docifyRequestSpy)

            // Switch to docify tab
            previewViewModel.setActiveTab('docify')

            // Call configuration changed multiple times
            previewViewModel.configurationChanged()
            previewViewModel.configurationChanged()

            // Wait for debounced operations
            await vi.runAllTimersAsync()

            // Should trigger docify refresh only once due to debouncing
            expect(docifyRequestSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('active tab management', () => {
        it('should start with model tab active', () => {
            const state = previewViewModel.getPreviewState()
            expect(state.activeTab).toBe('model')
        })

        it('should switch to template tab', () => {
            previewViewModel.setActiveTab('template')
            const state = previewViewModel.getPreviewState()
            expect(state.activeTab).toBe('template')
        })

        it('should switch to docify tab', () => {
            previewViewModel.setActiveTab('docify')
            const state = previewViewModel.getPreviewState()
            expect(state.activeTab).toBe('docify')
        })

        it('should emit active tab changed event', () => {
            const tabChangedSpy = vi.fn()
            previewViewModel.onActiveTabChanged(tabChangedSpy)

            previewViewModel.setActiveTab('docify')

            expect(tabChangedSpy).toHaveBeenCalledWith('docify')
        })
    })

    describe('visibility management', () => {
        it('should start as not visible', () => {
            const state = previewViewModel.getPreviewState()
            expect(state.isVisible).toBe(false)
        })

        it('should set visibility state', () => {
            previewViewModel.setVisible(true)
            let state = previewViewModel.getPreviewState()
            expect(state.isVisible).toBe(true)

            previewViewModel.setVisible(false)
            state = previewViewModel.getPreviewState()
            expect(state.isVisible).toBe(false)
        })

        it('should emit visibility changed event', () => {
            const visibilitySpy = vi.fn()
            previewViewModel.onVisibilityChanged(visibilitySpy)

            previewViewModel.setVisible(true)
            expect(visibilitySpy).toHaveBeenCalledWith(true)

            previewViewModel.setVisible(false)
            expect(visibilitySpy).toHaveBeenCalledWith(false)
        })
    })

    describe('ready state management', () => {
        it('should start as not ready', () => {
            const state = previewViewModel.getPreviewState()
            expect(state.isReady).toBe(false)
        })

        it('should set ready state', () => {
            previewViewModel.setReady(true)
            let state = previewViewModel.getPreviewState()
            expect(state.isReady).toBe(true)

            previewViewModel.setReady(false)
            state = previewViewModel.getPreviewState()
            expect(state.isReady).toBe(false)
        })

        it('should emit ready state changed event', () => {
            const readySpy = vi.fn()
            previewViewModel.onReadyStateChanged(readySpy)

            previewViewModel.setReady(true)
            expect(readySpy).toHaveBeenCalledWith(true)
        })
    })

    describe('PreviewViewModelInterface implementation', () => {
        it('should implement setData method', () => {
            const mockData = {
                graph: { nodes: [], edges: [] },
                selectedId: 'test-id'
            }

            previewViewModel.setData(mockData)

            const state = previewViewModel.getPreviewState()
            expect(state.selectedId).toBe('test-id')
        })

        it('should implement postSelect method', () => {
            const selectSpy = vi.fn()
            previewViewModel.onDidSelect(selectSpy)

            previewViewModel.postSelect('test-id')

            expect(selectSpy).toHaveBeenCalledWith('test-id')
        })

        it('should implement getCurrentUriPath method', () => {
            const testPath = '/test/path/file.calm'
            previewViewModel.setCurrentUri(testPath)

            const uri = previewViewModel.getCurrentUriPath()
            expect(uri).toBe(testPath)
        })

        it('should implement revealFile method', () => {
            const testPath = '/test/path/file.calm'
            previewViewModel.revealFile(testPath)

            const uri = previewViewModel.getCurrentUriPath()
            expect(uri).toBe(testPath)
        })

        it('should register reveal in editor handler', () => {
            const revealSpy = vi.fn()
            previewViewModel.onRevealInEditor(revealSpy)

            // Verify handler was registered
            expect(revealSpy).not.toHaveBeenCalled()
        })

        it('should implement setGetCurrentTreeSelection method', () => {
            const mockFn = vi.fn(() => 'tree-selection-id')
            previewViewModel.setGetCurrentTreeSelection(mockFn)

            const result = previewViewModel.getCurrentTreeSelection()

            expect(result).toBe('tree-selection-id')
            expect(mockFn).toHaveBeenCalled()
        })
    })
})
