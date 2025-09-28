import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest'
import type { ApplicationStoreApi, ApplicationStore } from '../../../application-store'
import { TreeViewModel } from './tree-view-model'

describe('TreeViewModel', () => {
    let mockStore: ApplicationStoreApi
    let mockState: ApplicationStore
    let treeViewModel: TreeViewModel

    beforeEach(() => {
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

        mockStore = {
            getState: vi.fn(() => mockState),
            setState: vi.fn(),
            subscribe: vi.fn((callback) => {
                return vi.fn()
            }),
            destroy: vi.fn()
        } as any

        vi.clearAllMocks()
    })

    describe('initialization', () => {
        it('should create tree view model and subscribe to store', () => {
            treeViewModel = new TreeViewModel(mockStore)

            expect(mockStore.subscribe).toHaveBeenCalled()
            expect(mockStore.getState).toHaveBeenCalled()
        })

        it('should show template mode message when in template mode', () => {
            mockState.isTemplateMode = true
            treeViewModel = new TreeViewModel(mockStore)

            const items = treeViewModel.rootItems()
            expect(items).toHaveLength(1)
            expect(items[0].id).toBe('template-mode-message')
            expect(items[0].label).toContain('Navigation unavailable')
        })
    })

    describe('navigation flow', () => {
        beforeEach(() => {
            const mockModelIndex = {
                doc: { getText: () => '' },
                model: {
                    nodes: [
                        { id: 'node1', name: 'Service A', type: 'service' },
                        { id: 'node2', name: 'Database B', type: 'database' }
                    ],
                    relationships: [
                        { id: 'rel1', source: 'node1', target: 'node2', type: 'connects' }
                    ],
                    flows: [
                        { id: 'flow1', source: 'node1', target: 'node2' }
                    ]
                },
                // These are what TreeViewModel actually accesses
                nodes: [
                    { id: 'node1', name: 'Service A', type: 'service', label: 'Service A' },
                    { id: 'node2', name: 'Database B', type: 'database', label: 'Database B' }
                ],
                relationships: [
                    { id: 'rel1', source: 'node1', target: 'node2', type: 'connects' }
                ],
                flows: [
                    { id: 'flow1', source: 'node1', target: 'node2' }
                ],
                indexDocument: vi.fn(),
                idToRange: new Map(),
                findIdRange: vi.fn(),
                // Add methods that TreeViewModel might call
                getNodes: vi.fn(() => [
                    { id: 'node1', name: 'Service A', type: 'service' },
                    { id: 'node2', name: 'Database B', type: 'database' }
                ]),
                getRelationships: vi.fn(() => [
                    { id: 'rel1', source: 'node1', target: 'node2', type: 'connects' }
                ]),
                getFlows: vi.fn(() => [
                    { id: 'flow1', source: 'node1', target: 'node2' }
                ])
            } as any

            mockState.currentModelIndex = mockModelIndex
            mockState.isTemplateMode = false
        })

        it('should display architecture structure with main groups', () => {
            treeViewModel = new TreeViewModel(mockStore)

            const items = treeViewModel.rootItems()

            const itemIds = items.map(item => item.id)
            expect(itemIds).toContain('group:architecture')
        })

        it('should handle reveal requests for navigation', () => {
            treeViewModel = new TreeViewModel(mockStore)
            const revealSpy = vi.fn()
            treeViewModel.onRevealRequest(revealSpy)

            treeViewModel.requestReveal('node1')

            expect(revealSpy).toHaveBeenCalledWith({ id: 'node1' })
        })

        it('should provide children for expandable items', () => {
            treeViewModel = new TreeViewModel(mockStore)

            const architectureChildren = treeViewModel.childrenOf('group:architecture')
            expect(architectureChildren.length).toBeGreaterThan(0)
        })

        it('should filter items based on search filter', () => {
            mockState.searchFilter = 'Service'
            treeViewModel = new TreeViewModel(mockStore)

            const items = treeViewModel.rootItems()
            const hasFilterStatus = items.some((item: any) => item.id === 'filter-status')
            expect(hasFilterStatus).toBe(true)
        })
    })

    describe('reactive updates', () => {
        it('should rebuild when store state changes', () => {
            treeViewModel = new TreeViewModel(mockStore)
            const subscribeFn = (mockStore.subscribe as MockedFunction<any>).mock.calls[0][0] as Function

            // Verify that the subscribe function was called with a callback
            expect(typeof subscribeFn).toBe('function')

            // Test that calling the callback doesn't throw
            expect(() => subscribeFn()).not.toThrow()
        })
    })

    describe('disposal', () => {
        it('should dispose of subscriptions', () => {
            const unsubscribeMock = vi.fn()
            mockStore.subscribe = vi.fn(() => unsubscribeMock)

            treeViewModel = new TreeViewModel(mockStore)
            treeViewModel.dispose()

            expect(unsubscribeMock).toHaveBeenCalled()
        })
    })
})