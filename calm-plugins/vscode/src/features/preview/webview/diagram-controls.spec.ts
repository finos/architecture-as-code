// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DiagramControls } from './diagram-controls'
import { PanZoomManager } from './pan-zoom-manager'

vi.mock('svg-pan-zoom', () => ({
    default: vi.fn(function () { return {
        zoom: vi.fn(),
        getZoom: vi.fn(function () { return 1; }),
        getPan: vi.fn(function () { return { x: 0, y: 0 }; }),
        pan: vi.fn(),
        resetZoom: vi.fn(),
        resetPan: vi.fn(),
        fit: vi.fn(),
        center: vi.fn(),
        resize: vi.fn(),
        updateBBox: vi.fn(),
        enablePan: vi.fn(),
        enableZoom: vi.fn(),
        disablePan: vi.fn(),
        disableZoom: vi.fn(),
        destroy: vi.fn(),
    }; })
}))

function createManager(): PanZoomManager {
    const manager = new PanZoomManager()
    manager.initialize({} as SVGSVGElement)
    return manager
}

function getButtons(parent: HTMLElement): HTMLButtonElement[] {
    return Array.from(parent.querySelectorAll('button.diagram-control-btn'))
}

describe('DiagramControls', () => {
    let parent: HTMLElement

    beforeEach(() => {
        parent = document.createElement('div')
    })

    it('renders zoom in, zoom out and fit controls', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        const labels = getButtons(parent).map(btn => btn.textContent)
        expect(labels).toEqual(['➕', '➖', '⊡'])
    })

    it('calls the pan/zoom manager and the matching callback when a button is clicked', () => {
        const manager = createManager()
        const zoomInSpy = vi.spyOn(manager, 'zoomIn')
        const onZoomIn = vi.fn()
        const controls = new DiagramControls(manager, { onZoomIn })
        controls.createControls(parent)

        getButtons(parent)[0].dispatchEvent(new Event('click'))

        expect(zoomInSpy).toHaveBeenCalledTimes(1)
        expect(onZoomIn).toHaveBeenCalledTimes(1)
    })

    it('does not render any export control - that is DiagramExportControl\'s responsibility', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        expect(parent.querySelector('.diagram-export-control')).toBeNull()
    })

    it('returns the toolbar container so callers can compose additional controls into it', () => {
        const controls = new DiagramControls(createManager())
        const toolbar = controls.createControls(parent)

        expect(toolbar.className).toBe('diagram-controls')
        expect(parent.contains(toolbar)).toBe(true)
    })

    it('removes the controls from the DOM on destroy', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)
        expect(parent.querySelector('.diagram-controls')).not.toBeNull()

        controls.destroy()

        expect(parent.querySelector('.diagram-controls')).toBeNull()
    })
})
