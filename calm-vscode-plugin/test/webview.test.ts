/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock cytoscape and layouts before importing the webview script
const addCalls: any[] = []
const layoutRuns: any[] = []
let elementsLen = 0
const fakeCy = {
    elements: () => ({ length: elementsLen, remove: vi.fn(), unselect: vi.fn(), filter: () => ({ length: 0, select: vi.fn() }) }),
    add: vi.fn((eles: any) => addCalls.push(eles)),
    layout: vi.fn((opts: any) => ({ run: vi.fn(() => layoutRuns.push(opts)) })),
    fit: vi.fn(),
    center: vi.fn(),
    resize: vi.fn(),
    style: vi.fn(),
    nodes: vi.fn(() => []),
    on: vi.fn(),
    pan: undefined,
    zoom: undefined,
}
vi.mock('cytoscape', () => {
    const fn = (opts: any) => fakeCy
        ; (fn as any).use = vi.fn()
    return { __esModule: true, default: fn }
})
vi.mock('cytoscape-fcose', () => ({ __esModule: true, default: {} }))
vi.mock('cytoscape-dagre', () => ({ __esModule: true, default: {} }))

    // Minimal VS Code API shim
    ; (global as any).acquireVsCodeApi = () => ({ postMessage: vi.fn() })

describe('webview render pipeline', () => {
    beforeEach(() => {
        addCalls.length = 0
        layoutRuns.length = 0
        elementsLen = 0
        document.body.innerHTML = `
      <div id="toolbar">
        <input type="checkbox" id="labels" checked>
        <input type="checkbox" id="descriptions">
        <button id="fit"></button>
    <button id="reset"></button>
      </div>
      <div id="container">
        <div id="cy"></div>
        <div id="divider"></div>
        <div id="details"><pre id="detailsPre"></pre></div>
      </div>
    `
        // Import fresh module each test
        vi.resetModules()
    })

    it('renders elements after setData', async () => {
        await import('../src/webview/main')
        const data = { type: 'setData', graph: { nodes: [{ id: 'n1', label: 'N1' }], edges: [] }, settings: { layout: 'dagre', showLabels: true } }
        window.dispatchEvent(new MessageEvent('message', { data }))
        expect(layoutRuns.length).toBeGreaterThan(0)
    })

    it('does not center on selection passed with setData', async () => {
        await import('../src/webview/main')
        const data = { type: 'setData', graph: { nodes: [{ id: 'a', label: 'A' }], edges: [] }, selectedId: 'a', settings: { layout: 'dagre', showLabels: true } }
        window.dispatchEvent(new MessageEvent('message', { data }))
        // center should not be called for setData selection
        expect((fakeCy.center as any).mock.calls.length).toBe(0)
    })

    it('does not center on subsequent select messages', async () => {
        await import('../src/webview/main')
        const first = { type: 'setData', graph: { nodes: [{ id: 'a', label: 'A' }], edges: [] }, settings: { layout: 'dagre', showLabels: true } }
        window.dispatchEvent(new MessageEvent('message', { data: first }))
            ; (fakeCy.center as any).mockClear()
        // send select message
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'select', id: 'a' } }))
        // allow debounce to fire
        await new Promise(r => setTimeout(r, 50))
        expect((fakeCy.center as any).mock.calls.length).toBe(0)
    })

    it('does not fit again on subsequent setData updates', async () => {
        await import('../src/webview/main')
        const first = { type: 'setData', graph: { nodes: [{ id: 'a', label: 'A' }], edges: [] }, settings: { layout: 'dagre', showLabels: true } }
        window.dispatchEvent(new MessageEvent('message', { data: first }))
        const fitCallsAfterFirst = (fakeCy.fit as any).mock.calls.length
        // Update with a label change; settings may be resent by host
        const second = { type: 'setData', graph: { nodes: [{ id: 'a', label: 'A2' }], edges: [] }, settings: { layout: 'dagre', showLabels: true } }
        // Simulate that the canvas already has elements after the first render
        elementsLen = 1
        window.dispatchEvent(new MessageEvent('message', { data: second }))
        const fitCallsAfterSecond = (fakeCy.fit as any).mock.calls.length
        expect(fitCallsAfterSecond).toBe(fitCallsAfterFirst)
    })

    it('skips initial layout when positions are provided', async () => {
        await import('../src/webview/main')
            // Reset layout tracking
            ; (layoutRuns as any).length = 0
        elementsLen = 0
        const data = { type: 'setData', graph: { nodes: [{ id: 'n1', label: 'N1' }], edges: [] }, positions: { n1: { x: 100, y: 200 } }, settings: { layout: 'dagre', showLabels: true } }
        window.dispatchEvent(new MessageEvent('message', { data }))
        // No layout run because we had a saved position for n1
        expect(layoutRuns.length).toBe(0)
    })
})
