import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CalmModelViewModel } from './calm-model.view-model'

describe('CalmModelViewModel', () => {
    let calmModelViewModel: CalmModelViewModel

    beforeEach(() => {
        calmModelViewModel = new CalmModelViewModel()
    })

    afterEach(() => {
        calmModelViewModel.dispose()
    })

    describe('initialization', () => {
        it('should create calm model view model with default state', () => {
            expect(calmModelViewModel).toBeDefined()
            expect(calmModelViewModel instanceof CalmModelViewModel).toBe(true)
            expect(calmModelViewModel.getModelData()).toBeNull()
            expect(calmModelViewModel.getSelectedId()).toBeUndefined()
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should have proper initial state', () => {
            const state = calmModelViewModel.getState()

            expect(state).toEqual({
                hasData: false,
                selectedId: undefined
            })
        })
    })

    describe('model data management', () => {
        it('should set and get model data', () => {
            const mockModelData = {
                nodes: [
                    { id: 'node1', name: 'Service A', type: 'service' },
                    { id: 'node2', name: 'Database B', type: 'database' }
                ],
                relationships: [
                    { id: 'rel1', source: 'node1', target: 'node2' }
                ]
            }

            calmModelViewModel.setModelData(mockModelData)

            expect(calmModelViewModel.getModelData()).toBe(mockModelData)
            expect(calmModelViewModel.hasData()).toBe(true)
        })

        it('should emit data changed event when setting model data', () => {
            const dataChangedSpy = vi.fn()
            calmModelViewModel.onDataChanged(dataChangedSpy)

            const mockModelData = { nodes: [], relationships: [] }
            calmModelViewModel.setModelData(mockModelData)

            expect(dataChangedSpy).toHaveBeenCalledWith({
                modelData: mockModelData,
                selectedId: undefined
            })
        })

        it('should handle setting null model data', () => {
            // Set some data first
            calmModelViewModel.setModelData({ test: 'data' })
            expect(calmModelViewModel.hasData()).toBe(true)

            // Set to null
            calmModelViewModel.setModelData(null)

            expect(calmModelViewModel.getModelData()).toBeNull()
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should handle setting undefined model data', () => {
            calmModelViewModel.setModelData(undefined)

            expect(calmModelViewModel.getModelData()).toBeUndefined()
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should emit data changed event with current selection when setting model data', () => {
            const dataChangedSpy = vi.fn()

            // Set selection first
            calmModelViewModel.setSelectedId('test-selection')
            calmModelViewModel.onDataChanged(dataChangedSpy)

            const mockModelData = { test: 'data' }
            calmModelViewModel.setModelData(mockModelData)

            expect(dataChangedSpy).toHaveBeenCalledWith({
                modelData: mockModelData,
                selectedId: 'test-selection'
            })
        })
    })

    describe('selection management', () => {
        it('should set and get selected ID', () => {
            expect(calmModelViewModel.getSelectedId()).toBeUndefined()

            calmModelViewModel.setSelectedId('element-123')
            expect(calmModelViewModel.getSelectedId()).toBe('element-123')

            calmModelViewModel.setSelectedId('element-456')
            expect(calmModelViewModel.getSelectedId()).toBe('element-456')
        })

        it('should emit selection changed event when setting selected ID', () => {
            const selectionChangedSpy = vi.fn()
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)

            calmModelViewModel.setSelectedId('element-123')

            expect(selectionChangedSpy).toHaveBeenCalledWith('element-123')
        })

        it('should emit data changed event when setting selected ID', () => {
            const dataChangedSpy = vi.fn()
            const mockModelData = { test: 'data' }

            calmModelViewModel.setModelData(mockModelData)
            calmModelViewModel.onDataChanged(dataChangedSpy)

            calmModelViewModel.setSelectedId('element-123')

            expect(dataChangedSpy).toHaveBeenCalledWith({
                modelData: mockModelData,
                selectedId: 'element-123'
            })
        })

        it('should not emit events when setting same selected ID', () => {
            calmModelViewModel.setSelectedId('element-123')

            const selectionChangedSpy = vi.fn()
            const dataChangedSpy = vi.fn()
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)
            calmModelViewModel.onDataChanged(dataChangedSpy)

            // Set same ID again
            calmModelViewModel.setSelectedId('element-123')

            expect(selectionChangedSpy).not.toHaveBeenCalled()
            expect(dataChangedSpy).not.toHaveBeenCalled()
        })

        it('should handle setting undefined selected ID', () => {
            // Set a selection first
            calmModelViewModel.setSelectedId('element-123')
            expect(calmModelViewModel.getSelectedId()).toBe('element-123')

            const selectionChangedSpy = vi.fn()
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)

            // Clear selection
            calmModelViewModel.setSelectedId(undefined)

            expect(calmModelViewModel.getSelectedId()).toBeUndefined()
            expect(selectionChangedSpy).toHaveBeenCalledWith(undefined)
        })

        it('should emit events when changing from undefined to defined selection', () => {
            expect(calmModelViewModel.getSelectedId()).toBeUndefined()

            const selectionChangedSpy = vi.fn()
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)

            calmModelViewModel.setSelectedId('element-123')

            expect(selectionChangedSpy).toHaveBeenCalledWith('element-123')
        })
    })

    describe('editor reveal functionality', () => {
        it('should emit reveal in editor request', () => {
            const revealSpy = vi.fn()
            calmModelViewModel.onRevealInEditorRequest(revealSpy)

            calmModelViewModel.revealInEditor('element-123')

            expect(revealSpy).toHaveBeenCalledWith('element-123')
        })

        it('should handle multiple reveal requests', () => {
            const revealSpy = vi.fn()
            calmModelViewModel.onRevealInEditorRequest(revealSpy)

            calmModelViewModel.revealInEditor('element-123')
            calmModelViewModel.revealInEditor('element-456')
            calmModelViewModel.revealInEditor('element-789')

            expect(revealSpy).toHaveBeenCalledTimes(3)
            expect(revealSpy).toHaveBeenNthCalledWith(1, 'element-123')
            expect(revealSpy).toHaveBeenNthCalledWith(2, 'element-456')
            expect(revealSpy).toHaveBeenNthCalledWith(3, 'element-789')
        })
    })

    describe('state management', () => {
        it('should get complete state for debugging', () => {
            const mockModelData = { nodes: [], relationships: [] }
            calmModelViewModel.setModelData(mockModelData)
            calmModelViewModel.setSelectedId('element-123')

            const state = calmModelViewModel.getState()

            expect(state).toEqual({
                hasData: true,
                selectedId: 'element-123'
            })
        })

        it('should reset all state', () => {
            const mockModelData = { test: 'data' }
            calmModelViewModel.setModelData(mockModelData)
            calmModelViewModel.setSelectedId('element-123')

            const dataChangedSpy = vi.fn()
            const selectionChangedSpy = vi.fn()
            calmModelViewModel.onDataChanged(dataChangedSpy)
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)

            calmModelViewModel.reset()

            expect(calmModelViewModel.getModelData()).toBeNull()
            expect(calmModelViewModel.getSelectedId()).toBeUndefined()
            expect(calmModelViewModel.hasData()).toBe(false)

            expect(dataChangedSpy).toHaveBeenCalledWith({
                modelData: null,
                selectedId: undefined
            })
            expect(selectionChangedSpy).toHaveBeenCalledWith(undefined)
        })

        it('should have proper state after reset', () => {
            // Set some state first
            calmModelViewModel.setModelData({ test: 'data' })
            calmModelViewModel.setSelectedId('element-123')

            calmModelViewModel.reset()

            const state = calmModelViewModel.getState()
            expect(state).toEqual({
                hasData: false,
                selectedId: undefined
            })
        })
    })

    describe('data presence checks', () => {
        it('should return false for hasData with null data', () => {
            calmModelViewModel.setModelData(null)
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should return false for hasData with undefined data', () => {
            calmModelViewModel.setModelData(undefined)
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should return true for hasData with empty object', () => {
            calmModelViewModel.setModelData({})
            expect(calmModelViewModel.hasData()).toBe(true)
        })

        it('should return true for hasData with empty array', () => {
            calmModelViewModel.setModelData([])
            expect(calmModelViewModel.hasData()).toBe(true)
        })

        it('should return true for hasData with string data', () => {
            calmModelViewModel.setModelData('test')
            expect(calmModelViewModel.hasData()).toBe(true)
        })

        it('should return false for hasData with empty string', () => {
            calmModelViewModel.setModelData('')
            expect(calmModelViewModel.hasData()).toBe(false)
        })

        it('should return true for hasData with number data', () => {
            calmModelViewModel.setModelData(42)
            expect(calmModelViewModel.hasData()).toBe(true)
        })

        it('should return false for hasData with zero', () => {
            calmModelViewModel.setModelData(0)
            expect(calmModelViewModel.hasData()).toBe(false)
        })
    })

    describe('disposal', () => {
        it('should dispose without errors', () => {
            expect(() => calmModelViewModel.dispose()).not.toThrow()
        })

        it('should dispose all emitters', () => {
            // Set up event listeners
            const dataChangedSpy = vi.fn()
            const selectionChangedSpy = vi.fn()
            const revealSpy = vi.fn()

            calmModelViewModel.onDataChanged(dataChangedSpy)
            calmModelViewModel.onSelectionChanged(selectionChangedSpy)
            calmModelViewModel.onRevealInEditorRequest(revealSpy)

            // Dispose
            calmModelViewModel.dispose()

            // Try to trigger events after disposal - they should not fire
            calmModelViewModel.setModelData({ test: 'data' })
            calmModelViewModel.setSelectedId('element-123')
            calmModelViewModel.revealInEditor('element-456')

            // Events should not be called after disposal
            expect(dataChangedSpy).not.toHaveBeenCalled()
            expect(selectionChangedSpy).not.toHaveBeenCalled()
            expect(revealSpy).not.toHaveBeenCalled()
        })

        it('should allow multiple dispose calls', () => {
            calmModelViewModel.dispose()
            expect(() => calmModelViewModel.dispose()).not.toThrow()
        })
    })
})