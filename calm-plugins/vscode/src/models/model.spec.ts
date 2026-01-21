import { describe, it, expect } from 'vitest'
import { loadCalmModel, detectCalmModel, toGraph } from './model'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('model', () => {
    describe('detectCalmModel', () => {
        it('should detect valid CALM JSON model', () => {
            const json = JSON.stringify({ nodes: [], relationships: [] })
            expect(detectCalmModel(json)).toBe(true)
        })

        it('should detect CALM model with only nodes', () => {
            const json = JSON.stringify({ nodes: [{ id: 'node1' }] })
            expect(detectCalmModel(json)).toBe(true)
        })

        it('should detect CALM model with only flows', () => {
            const json = JSON.stringify({ flows: [{ id: 'flow1' }] })
            expect(detectCalmModel(json)).toBe(true)
        })

        it('should not detect non-CALM object', () => {
            const json = JSON.stringify({ foo: 'bar' })
            expect(detectCalmModel(json)).toBe(false)
        })

        it('should not detect invalid JSON', () => {
            expect(detectCalmModel('not json')).toBe(false)
        })
    })

    describe('loadCalmModel', () => {
        it('should parse test.architecture.json and extract relationships', () => {
            // Use path relative to project root (vscode plugin directory)
            const testArchPath = resolve(process.cwd(), 'test-architectures/test.architecture.json')
            const content = readFileSync(testArchPath, 'utf-8')
            const model = loadCalmModel(content)

            // Check nodes
            expect(model.nodes).toBeDefined()
            expect(model.nodes?.length).toBe(4)
            expect(model.nodes?.map(n => n.id)).toEqual(['user', 'web-frontend', 'api-server', 'database'])

            // Check relationships are parsed correctly
            expect(model.relationships).toBeDefined()
            expect(model.relationships?.length).toBeGreaterThan(0)

            // Check interacts relationship (user -> web-frontend)
            const interactsRel = model.relationships?.find(r => r.type === 'interacts')
            expect(interactsRel).toBeDefined()
            expect(interactsRel?.source).toBe('user')
            expect(interactsRel?.target).toBe('web-frontend')

            // Check connects relationships (frontend -> api, api -> database)
            const connectsRels = model.relationships?.filter(r => r.type === 'connects')
            expect(connectsRels?.length).toBe(2)

            const frontendToApi = connectsRels?.find(r => r.source === 'web-frontend' && r.target === 'api-server')
            expect(frontendToApi).toBeDefined()
            expect(frontendToApi?.label).toBe('Sends API requests to')
            expect(frontendToApi?.raw?.protocol).toBe('HTTPS')

            const apiToDb = connectsRels?.find(r => r.source === 'api-server' && r.target === 'database')
            expect(apiToDb).toBeDefined()
            expect(apiToDb?.label).toBe('Reads and writes application data to')
            expect(apiToDb?.raw?.protocol).toBe('JDBC')
        })

        it('should handle empty input', () => {
            const model = loadCalmModel('')
            expect(model).toEqual({ nodes: [], relationships: [], flows: [] })
        })

        it('should parse JSON format', () => {
            const json = JSON.stringify({
                nodes: [{ 'unique-id': 'node1', name: 'Node 1' }],
                relationships: []
            })
            const model = loadCalmModel(json)
            expect(model.nodes?.length).toBe(1)
            expect(model.nodes?.[0].id).toBe('node1')
        })

        it('should parse YAML format', () => {
            const yaml = `
nodes:
  - unique-id: node1
    name: Node 1
relationships: []
`
            const model = loadCalmModel(yaml)
            expect(model.nodes?.length).toBe(1)
            expect(model.nodes?.[0].id).toBe('node1')
        })

        it('should normalize deployed-in relationships', () => {
            const json = JSON.stringify({
                nodes: [
                    { 'unique-id': 'service1' },
                    { 'unique-id': 'container1' }
                ],
                relationships: [{
                    'unique-id': 'rel1',
                    'relationship-type': {
                        'deployed-in': {
                            container: 'container1',
                            nodes: ['service1']
                        }
                    }
                }]
            })
            const model = loadCalmModel(json)
            expect(model.relationships?.length).toBe(1)
            expect(model.relationships?.[0].type).toBe('deployed-in')
            expect(model.relationships?.[0].source).toBe('service1')
            expect(model.relationships?.[0].target).toBe('container1')
        })

        it('should normalize composed-of relationships', () => {
            const json = JSON.stringify({
                nodes: [
                    { 'unique-id': 'component1' },
                    { 'unique-id': 'system1' }
                ],
                relationships: [{
                    'unique-id': 'rel1',
                    'relationship-type': {
                        'composed-of': {
                            container: 'system1',
                            nodes: ['component1']
                        }
                    }
                }]
            })
            const model = loadCalmModel(json)
            expect(model.relationships?.length).toBe(1)
            expect(model.relationships?.[0].type).toBe('composed-of')
            expect(model.relationships?.[0].source).toBe('component1')
            expect(model.relationships?.[0].target).toBe('system1')
        })
    })

    describe('toGraph', () => {
        it('should convert model to graph structure', () => {
            const model = {
                nodes: [
                    { id: 'node1', label: 'Node 1', type: 'service', description: 'A service', raw: {} },
                    { id: 'node2', label: 'Node 2', type: 'database', description: 'A database', raw: {} }
                ],
                relationships: [
                    { id: 'rel1', source: 'node1', target: 'node2', label: 'connects', type: 'connects', description: 'Connection', raw: {} }
                ]
            }
            const graph = toGraph(model)
            expect(graph.nodes.length).toBe(2)
            expect(graph.edges.length).toBe(1)
            expect(graph.edges[0].source).toBe('node1')
            expect(graph.edges[0].target).toBe('node2')
        })

        it('should handle deployed-in relationships as parent-child', () => {
            const model = {
                nodes: [
                    { id: 'service', label: 'Service', type: 'service', description: 'A service', raw: {} },
                    { id: 'container', label: 'Container', type: 'container', description: 'A container', raw: {} }
                ],
                relationships: [
                    { id: 'rel1', source: 'service', target: 'container', type: 'deployed-in', description: 'Deployed in', raw: {} }
                ]
            }
            const graph = toGraph(model)
            const serviceNode = graph.nodes.find(n => n.id === 'service')
            expect(serviceNode?.parent).toBe('container')
            // deployed-in should not create an edge
            expect(graph.edges.length).toBe(0)
        })

        it('should create synthetic container nodes if not declared', () => {
            const model = {
                nodes: [
                    { id: 'service', label: 'Service', type: 'service', description: 'A service', raw: {} }
                ],
                relationships: [
                    { id: 'rel1', source: 'service', target: 'undeclared-container', type: 'deployed-in', description: 'Deployed in', raw: {} }
                ]
            }
            const graph = toGraph(model)
            expect(graph.nodes.length).toBe(2)
            const containerNode = graph.nodes.find(n => n.id === 'undeclared-container')
            expect(containerNode).toBeDefined()
            expect(containerNode?.raw?.synthesized).toBe(true)
        })
    })
})
