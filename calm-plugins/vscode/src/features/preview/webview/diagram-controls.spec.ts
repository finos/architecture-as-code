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

    it('does not render export buttons when no export callbacks are provided', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        const labels = getButtons(parent).map(btn => btn.textContent)
        expect(labels).not.toContain('SVG')
        expect(labels).not.toContain('PNG')
    })

    it('renders an SVG export button and invokes the callback on click', () => {
        const onExportSvg = vi.fn()
        const controls = new DiagramControls(createManager(), { onExportSvg })
        controls.createControls(parent)

        const button = getButtons(parent).find(btn => btn.textContent === 'SVG')
        expect(button).toBeDefined()
        expect(button?.title).toBe('Export diagram as SVG')

        button?.click()
        expect(onExportSvg).toHaveBeenCalledTimes(1)
    })

    it('renders a PNG export button and invokes the callback on click', () => {
        const onExportPng = vi.fn()
        const controls = new DiagramControls(createManager(), { onExportPng })
        controls.createControls(parent)

        const button = getButtons(parent).find(btn => btn.textContent === 'PNG')
        expect(button).toBeDefined()
        expect(button?.title).toBe('Export diagram as PNG')

        button?.click()
        expect(onExportPng).toHaveBeenCalledTimes(1)
    })

    it('still renders the existing zoom and fit controls', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        const labels = getButtons(parent).map(btn => btn.textContent)
        expect(labels).toEqual(['➕', '➖', '⊡'])
    })
})
