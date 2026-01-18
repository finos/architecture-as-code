import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CalmModel } from './model'

// Mock vscode module - needs to be before importing ModelIndex
class MockRange {
    constructor(public start: any, public end: any) { }
    contains(pos: any): boolean {
        return pos >= this.start && pos <= this.end
    }
}

vi.mock('vscode', () => ({
    Range: MockRange
}))

// Import after mocking
import { ModelIndex } from './model-index'

describe('ModelIndex', () => {
    let mockDoc: any

    beforeEach(() => {
        mockDoc = {
            getText: vi.fn().mockReturnValue('{}'),
            positionAt: vi.fn((offset: number) => offset)
        }
    })

    describe('relationships getter', () => {
        it('should return empty array when model has no relationships', () => {
            const model: CalmModel = { nodes: [], relationships: [] }
            const index = new ModelIndex(mockDoc, model)

            expect(index.relationships).toEqual([])
        })

        it('should group relationships with same unique-id from interacts relationship', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1:node1',
                        source: 'actor1',
                        target: 'node1',
                        type: 'interacts',
                        label: 'interacts',
                        raw: {
                            'unique-id': 'rel1',
                            description: 'Actor interacts with nodes',
                            'relationship-type': {
                                interacts: {
                                    actor: 'actor1',
                                    nodes: ['node1', 'node2']
                                }
                            }
                        }
                    },
                    {
                        id: 'rel1:node2',
                        source: 'actor1',
                        target: 'node2',
                        type: 'interacts',
                        label: 'interacts',
                        raw: {
                            'unique-id': 'rel1',
                            description: 'Actor interacts with nodes',
                            'relationship-type': {
                                interacts: {
                                    actor: 'actor1',
                                    nodes: ['node1', 'node2']
                                }
                            }
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(1)
            expect(rels[0].id).toBe('rel1')
            expect(rels[0].label).toBe('Actor interacts with nodes')
        })

        it('should group relationships with same unique-id from deployed-in relationship', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'deploy1:service1',
                        source: 'service1',
                        target: 'container1',
                        type: 'deployed-in',
                        label: 'deployed-in',
                        raw: {
                            'unique-id': 'deploy1',
                            description: 'Services deployed in container',
                            'relationship-type': {
                                'deployed-in': {
                                    container: 'container1',
                                    nodes: ['service1', 'service2']
                                }
                            }
                        }
                    },
                    {
                        id: 'deploy1:service2',
                        source: 'service2',
                        target: 'container1',
                        type: 'deployed-in',
                        label: 'deployed-in',
                        raw: {
                            'unique-id': 'deploy1',
                            description: 'Services deployed in container',
                            'relationship-type': {
                                'deployed-in': {
                                    container: 'container1',
                                    nodes: ['service1', 'service2']
                                }
                            }
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(1)
            expect(rels[0].id).toBe('deploy1')
            expect(rels[0].label).toBe('Services deployed in container')
        })

        it('should group relationships with same unique-id from composed-of relationship', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'compose1:component1',
                        source: 'component1',
                        target: 'system1',
                        type: 'composed-of',
                        label: 'composed-of',
                        raw: {
                            'unique-id': 'compose1',
                            description: 'Components compose system',
                            'relationship-type': {
                                'composed-of': {
                                    container: 'system1',
                                    nodes: ['component1', 'component2']
                                }
                            }
                        }
                    },
                    {
                        id: 'compose1:component2',
                        source: 'component2',
                        target: 'system1',
                        type: 'composed-of',
                        label: 'composed-of',
                        raw: {
                            'unique-id': 'compose1',
                            description: 'Components compose system',
                            'relationship-type': {
                                'composed-of': {
                                    container: 'system1',
                                    nodes: ['component1', 'component2']
                                }
                            }
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(1)
            expect(rels[0].id).toBe('compose1')
            expect(rels[0].label).toBe('Components compose system')
        })

        it('should not group simple connects relationships', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'conn1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        label: 'Connection 1',
                        raw: {
                            'unique-id': 'conn1',
                            description: 'Connection 1',
                            'relationship-type': {
                                connects: {
                                    source: { node: 'node1' },
                                    destination: { node: 'node2' }
                                }
                            }
                        }
                    },
                    {
                        id: 'conn2',
                        source: 'node3',
                        target: 'node4',
                        type: 'connects',
                        label: 'Connection 2',
                        raw: {
                            'unique-id': 'conn2',
                            description: 'Connection 2',
                            'relationship-type': {
                                connects: {
                                    source: { node: 'node3' },
                                    destination: { node: 'node4' }
                                }
                            }
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(2)
            expect(rels[0].id).toBe('conn1')
            expect(rels[0].label).toBe('Connection 1')
            expect(rels[1].id).toBe('conn2')
            expect(rels[1].label).toBe('Connection 2')
        })

        it('should use raw.label as priority for label', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        label: 'Fallback Label',
                        raw: {
                            'unique-id': 'rel1',
                            label: 'Primary Label',
                            description: 'Description text'
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels[0].label).toBe('Primary Label')
        })

        it('should use raw.description as fallback for label', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        label: 'Model Label',
                        raw: {
                            'unique-id': 'rel1',
                            description: 'Description Label'
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels[0].label).toBe('Description Label')
        })

        it('should use relationship.label as fallback when raw has no label/description', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        label: 'Relationship Label',
                        raw: {
                            'unique-id': 'rel1'
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels[0].label).toBe('Relationship Label')
        })

        it('should use id as final fallback for label', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        raw: {
                            'unique-id': 'rel1'
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels[0].label).toBe('rel1')
        })

        it('should handle relationships without raw data', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'rel1',
                        source: 'node1',
                        target: 'node2',
                        type: 'connects',
                        label: 'Simple Label'
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(1)
            expect(rels[0].id).toBe('rel1')
            expect(rels[0].label).toBe('Simple Label')
        })

        it('should handle mixed relationship types', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [
                    {
                        id: 'interacts1:node1',
                        source: 'actor1',
                        target: 'node1',
                        type: 'interacts',
                        raw: {
                            'unique-id': 'interacts1',
                            description: 'Interacts relationship',
                            'relationship-type': {
                                interacts: {
                                    actor: 'actor1',
                                    nodes: ['node1', 'node2']
                                }
                            }
                        }
                    },
                    {
                        id: 'interacts1:node2',
                        source: 'actor1',
                        target: 'node2',
                        type: 'interacts',
                        raw: {
                            'unique-id': 'interacts1',
                            description: 'Interacts relationship',
                            'relationship-type': {
                                interacts: {
                                    actor: 'actor1',
                                    nodes: ['node1', 'node2']
                                }
                            }
                        }
                    },
                    {
                        id: 'conn1',
                        source: 'node1',
                        target: 'node3',
                        type: 'connects',
                        label: 'Direct connection',
                        raw: {
                            'unique-id': 'conn1'
                        }
                    }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const rels = index.relationships
            expect(rels.length).toBe(2)
            expect(rels.map(r => r.id).sort()).toEqual(['conn1', 'interacts1'])
        })
    })

    describe('nodes getter', () => {
        it('should return empty array when model has no nodes', () => {
            const model: CalmModel = { nodes: [], relationships: [] }
            const index = new ModelIndex(mockDoc, model)

            expect(index.nodes).toEqual([])
        })

        it('should map nodes with id, label, and nodeType', () => {
            const model: CalmModel = {
                nodes: [
                    { id: 'node1', label: 'Node 1', name: 'Node One', type: 'service', description: 'A service', raw: {} },
                    { id: 'node2', label: 'Node 2', name: 'Node Two', type: 'database', description: 'A database', raw: {} }
                ],
                relationships: []
            }
            const index = new ModelIndex(mockDoc, model)

            const nodes = index.nodes
            expect(nodes.length).toBe(2)
            expect(nodes[0]).toEqual({ id: 'node1', label: 'Node 1', nodeType: 'service' })
            expect(nodes[1]).toEqual({ id: 'node2', label: 'Node 2', nodeType: 'database' })
        })

        it('should fallback to name if label is not present', () => {
            const model: CalmModel = {
                nodes: [
                    { id: 'node1', name: 'Node Name', type: 'service', description: 'A service', raw: {} }
                ],
                relationships: []
            }
            const index = new ModelIndex(mockDoc, model)

            const nodes = index.nodes
            expect(nodes[0].label).toBe('Node Name')
        })

        it('should fallback to id if label and name are not present', () => {
            const model: CalmModel = {
                nodes: [
                    { id: 'node1', type: 'service', description: 'A service', raw: {} }
                ],
                relationships: []
            }
            const index = new ModelIndex(mockDoc, model)

            const nodes = index.nodes
            expect(nodes[0].label).toBe('node1')
        })
    })

    describe('flows getter', () => {
        it('should return empty array when model has no flows', () => {
            const model: CalmModel = { nodes: [], relationships: [], flows: [] }
            const index = new ModelIndex(mockDoc, model)

            expect(index.flows).toEqual([])
        })

        it('should map flows with id and label', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [],
                flows: [
                    { id: 'flow1', label: 'Flow 1', description: 'First flow', raw: {} },
                    { id: 'flow2', label: 'Flow 2', description: 'Second flow', raw: {} }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const flows = index.flows
            expect(flows.length).toBe(2)
            expect(flows[0]).toEqual({ id: 'flow1', label: 'Flow 1' })
            expect(flows[1]).toEqual({ id: 'flow2', label: 'Flow 2' })
        })

        it('should fallback to description if label is not present', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [],
                flows: [
                    { id: 'flow1', description: 'Flow description', raw: {} }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const flows = index.flows
            expect(flows[0].label).toBe('Flow description')
        })

        it('should fallback to id if label and description are not present', () => {
            const model: CalmModel = {
                nodes: [],
                relationships: [],
                flows: [
                    { id: 'flow1', raw: {} }
                ]
            }
            const index = new ModelIndex(mockDoc, model)

            const flows = index.flows
            expect(flows[0].label).toBe('flow1')
        })
    })

    // Note: indexDocument, idAt, and rangeOf tests are skipped because they require
    // the vscode module to be available via require(), which is difficult to mock in vitest.
    // These methods are integration-tested through the VSCode extension runtime.
})
