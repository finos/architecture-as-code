import { describe, it, expect } from 'vitest'
import { detectCalmModel, loadCalmModel, toGraph } from '../src/util/model'

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
})
