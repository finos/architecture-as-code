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

function selectExportItem(menu: Element, value: string): void {
    menu.dispatchEvent(new CustomEvent('vsc-context-menu-select', {
        detail: { label: '', keybinding: '', value, separator: false, tabindex: 0 },
    }))
}

describe('DiagramControls', () => {
    let parent: HTMLElement

    beforeEach(() => {
        parent = document.createElement('div')
    })

    it('does not render the export control when no export callbacks are provided', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        expect(parent.querySelector('.diagram-export-control')).toBeNull()
    })

    it('renders an Export dropdown with an SVG option and invokes the callback on selection', () => {
        const onExportSvg = vi.fn()
        const controls = new DiagramControls(createManager(), { onExportSvg })
        controls.createControls(parent)

        const trigger = parent.querySelector('.diagram-export-trigger')
        const menu = parent.querySelector('.diagram-export-menu') as (Element & { data: { label: string, value: string }[] })
        expect(trigger).not.toBeNull()
        expect(menu).not.toBeNull()
        expect(menu.data).toEqual([{ label: 'Export as SVG', value: 'svg' }])

        selectExportItem(menu, 'svg')
        expect(onExportSvg).toHaveBeenCalledTimes(1)
    })

    it('renders an Export dropdown with an SVG and PNG option and invokes the callback on selection', () => {
        const onExportSvg = vi.fn()
        const onExportPng = vi.fn()
        const controls = new DiagramControls(createManager(), { onExportSvg, onExportPng })
        controls.createControls(parent)

        const menu = parent.querySelector('.diagram-export-menu') as (Element & { data: { label: string, value: string }[] })
        expect(menu.data).toEqual([
            { label: 'Export as SVG', value: 'svg' },
            { label: 'Export as PNG', value: 'png' },
        ])

        selectExportItem(menu, 'png')
        expect(onExportPng).toHaveBeenCalledTimes(1)
        expect(onExportSvg).not.toHaveBeenCalled()
    })

    it('toggles the export menu when the trigger is clicked', () => {
        const controls = new DiagramControls(createManager(), { onExportSvg: vi.fn() })
        controls.createControls(parent)

        const trigger = parent.querySelector('.diagram-export-trigger') as (Element & { click?: () => void })
        const menu = parent.querySelector('.diagram-export-menu') as (Element & { show: boolean })
        expect(menu.show).toBe(false)

        trigger.dispatchEvent(new Event('click'))
        expect(menu.show).toBe(true)

        trigger.dispatchEvent(new Event('click'))
        expect(menu.show).toBe(false)
    })

    it('still renders the existing zoom and fit controls', () => {
        const controls = new DiagramControls(createManager())
        controls.createControls(parent)

        const labels = getButtons(parent).map(btn => btn.textContent)
        expect(labels).toEqual(['➕', '➖', '⊡'])
    })
})
