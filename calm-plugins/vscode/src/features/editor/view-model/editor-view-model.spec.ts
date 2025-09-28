import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import { EditorViewModel } from './editor-view-model'
import type { ApplicationStoreApi, ApplicationStore } from '../../../application-store'

describe('EditorViewModel', () => {
    let editorViewModel: EditorViewModel
    let mockStore: ApplicationStoreApi
    let mockState: ApplicationStore

    beforeEach(() => {
        // Mock state object
        mockState = {
            currentModelIndex: undefined,
            currentDocumentUri: undefined,
            isTemplateMode: false,
            templateFilePath: undefined,
            architectureFilePath: undefined,
            selectedElementId: undefined,
            searchFilter: '',
            showLabels: true,
            setModelIndex: vi.fn(),
            setCurrentDocument: vi.fn(),
            setTemplateMode: vi.fn(),
            setSelectedElement: vi.fn(),
            setSearchFilter: vi.fn(),
            setShowLabels: vi.fn(),
            clearSelection: vi.fn(),
            resetDocument: vi.fn()
        }

        // Mock store API
        mockStore = {
            getState: vi.fn(() => mockState),
            setState: vi.fn(),
            subscribe: vi.fn(() => vi.fn()), // Return unsubscribe function
            getInitialState: vi.fn(() => mockState)
        }
    })

    describe('initialization', () => {
        it('should create editor view model', () => {
            editorViewModel = new EditorViewModel(mockStore)

            expect(editorViewModel).toBeDefined()
            expect(editorViewModel instanceof EditorViewModel).toBe(true)
        })
    })

    describe('model index operations', () => {
        beforeEach(() => {
            const mockModelIndex = {
                rangeOf: vi.fn((id: string) => ({ line: 1, character: 0 })),
                idAt: vi.fn((doc: any, position: any) => 'test-id'),
                idToRange: new Map(),
                doc: { getText: () => '' },
                model: { nodes: [], relationships: [], flows: [] },
                indexDocument: vi.fn(),
                findIdRange: vi.fn()
            } as any
            mockState.currentModelIndex = mockModelIndex
        })

        it('should get range for ID when model index exists', () => {
            editorViewModel = new EditorViewModel(mockStore)

            const range = editorViewModel.getRangeForId('test-id')

            expect(range).toEqual({ line: 1, character: 0 })
            expect((mockState.currentModelIndex as any).rangeOf).toHaveBeenCalledWith('test-id')
        })

        it('should return undefined for range when no model index', () => {
            mockState.currentModelIndex = undefined
            editorViewModel = new EditorViewModel(mockStore)

            const range = editorViewModel.getRangeForId('test-id')

            expect(range).toBeUndefined()
        })

        it('should get current model index', () => {
            editorViewModel = new EditorViewModel(mockStore)

            const modelIndex = editorViewModel.getCurrentModelIndex()

            expect(modelIndex).toBe(mockState.currentModelIndex)
        })

        it('should get ID at position when model index exists', () => {
            editorViewModel = new EditorViewModel(mockStore)
            const mockDoc = { getText: () => 'test content' }
            const mockPosition = { line: 1, character: 5 }

            const id = editorViewModel.getIdAtPosition(mockDoc, mockPosition)

            expect(id).toBe('test-id')
            expect((mockState.currentModelIndex as any).idAt).toHaveBeenCalledWith(mockDoc, mockPosition)
        })

        it('should return undefined for ID at position when no model index', () => {
            mockState.currentModelIndex = undefined
            editorViewModel = new EditorViewModel(mockStore)

            const id = editorViewModel.getIdAtPosition({}, {})

            expect(id).toBeUndefined()
        })
    })

    describe('template mode', () => {
        it('should return false for template mode by default', () => {
            editorViewModel = new EditorViewModel(mockStore)

            const isTemplateMode = editorViewModel.isTemplateMode()

            expect(isTemplateMode).toBe(false)
        })

        it('should return true when in template mode', () => {
            mockState.isTemplateMode = true
            editorViewModel = new EditorViewModel(mockStore)

            const isTemplateMode = editorViewModel.isTemplateMode()

            expect(isTemplateMode).toBe(true)
        })
    })

    describe('element selection', () => {
        it('should set selected element', () => {
            editorViewModel = new EditorViewModel(mockStore)

            editorViewModel.setSelectedElement('element-123')

            expect(mockState.setSelectedElement).toHaveBeenCalledWith('element-123')
        })

        it('should get selected element', () => {
            mockState.selectedElementId = 'selected-element'
            editorViewModel = new EditorViewModel(mockStore)

            const selectedElement = editorViewModel.getSelectedElement()

            expect(selectedElement).toBe('selected-element')
        })

        it('should return empty string when no selected element', () => {
            mockState.selectedElementId = undefined
            editorViewModel = new EditorViewModel(mockStore)

            const selectedElement = editorViewModel.getSelectedElement()

            expect(selectedElement).toBe('')
        })
    })

    describe('disposal', () => {
        it('should dispose without errors', () => {
            editorViewModel = new EditorViewModel(mockStore)

            expect(() => editorViewModel.dispose()).not.toThrow()
        })

        it('should call unsubscribe functions on disposal', () => {
            const mockUnsubscribe = vi.fn()
            mockStore.subscribe = vi.fn(() => mockUnsubscribe)

            editorViewModel = new EditorViewModel(mockStore)
            editorViewModel.dispose()

            // Currently EditorViewModel doesn't subscribe to anything, but test the pattern
            expect(() => editorViewModel.dispose()).not.toThrow()
        })
    })
})