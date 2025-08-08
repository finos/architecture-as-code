import { describe, it, expect } from 'vitest'
import { detectCalmModel, loadCalmModel, toGraph } from '../src/util/model'
import { composeLabelWithDescription } from '../src/util/labels'

describe('model utils', () => {
    it('detects CALM model by structural check', () => {
        expect(detectCalmModel('{"nodes":[],"relationships":[],"flows":[]}')).toBe(true)
        expect(detectCalmModel('{"foo":1}')).toBe(false)
    })
    it('transforms to graph', () => {
        const model = loadCalmModel('{"nodes":[{"id":"a"}],"relationships":[{"id":"r","source":"a","target":"a"}],"flows":[]}')
        const g = toGraph(model, {} as any)
        expect(g.nodes.length).toBe(1)
        expect(g.edges.length).toBe(1)
    })

    it('maps deployed-in to parent containers and excludes deployed-in edges', () => {
        const text = JSON.stringify({
            nodes: [
                { id: 'svc' },
                { id: 'cluster' }
            ],
            relationships: [
                { id: 'd1', type: 'deployed-in', source: 'svc', target: 'cluster' },
                { id: 'r1', type: 'connects', source: 'svc', target: 'svc' }
            ]
        })
        const model = loadCalmModel(text)
        const g = toGraph(model, {} as any)
        const svc = g.nodes.find(n => n.id === 'svc')!
        expect(svc.parent).toBe('cluster')
        // deployed-in edges should not appear in edges list
        expect(g.edges.find(e => e.id === 'd1')).toBeUndefined()
        // other edges remain
        expect(g.edges.find(e => e.id === 'r1')).toBeDefined()
    })

        it('treats composed-of like deployed-in (parent mapping, no edge)', () => {
            const text = JSON.stringify({
                nodes: [
                    { id: 'a' },
                    { id: 'b' }
                ],
                relationships: [
                    { id: 'c1', type: 'composed-of', source: 'a', target: 'b' }
                ]
            })
            const model = loadCalmModel(text)
            const g = toGraph(model, {} as any)
            const a = g.nodes.find(n => n.id === 'a')!
            expect(a.parent).toBe('b')
            expect(g.edges.find(e => e.id === 'c1')).toBeUndefined()
        })

    it('supports nested composed-of containment and synthesizes missing containers', () => {
        const text = JSON.stringify({
            nodes: [
                { id: 'leaf' }
            ],
            relationships: [
                { id: 'c1', type: 'composed-of', source: 'leaf', target: 'mid' },
                { id: 'c2', type: 'composed-of', source: 'mid', target: 'root' }
            ]
        })
        const model = loadCalmModel(text)
        const g = toGraph(model, {} as any)
        // synthesized containers should exist
        const leaf = g.nodes.find(n => n.id === 'leaf')!
        const mid = g.nodes.find(n => n.id === 'mid')!
        const root = g.nodes.find(n => n.id === 'root')!
        expect(leaf.parent).toBe('mid')
        expect(mid.parent).toBe('root')
        expect(root.parent).toBeUndefined()
        // no composed-of edges
        expect(g.edges.find(e => e.id === 'c1')).toBeUndefined()
        expect(g.edges.find(e => e.id === 'c2')).toBeUndefined()
    })
})

describe('label composition', () => {
    it('does not duplicate description when same as label', () => {
        expect(composeLabelWithDescription('Foo', 'Foo')).toBe('Foo')
        expect(composeLabelWithDescription('', 'Desc')).toBe('Desc')
        expect(composeLabelWithDescription('Foo', 'Desc')).toBe('Foo — Desc')
        expect(composeLabelWithDescription('Contains Desc', 'Desc')).toBe('Contains Desc')
    })
})
