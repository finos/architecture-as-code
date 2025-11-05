import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PanZoomManager } from './pan-zoom-manager'

// Mock svg-pan-zoom
vi.mock('svg-pan-zoom', () => ({
    default: vi.fn(() => ({
        zoom: vi.fn(),
        getZoom: vi.fn(() => 1),
        getPan: vi.fn(() => ({ x: 0, y: 0 })),
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
    }))
}))

// Create a mock SVG element
function createMockSVG(): SVGSVGElement {
    return {} as SVGSVGElement
}

describe('PanZoomManager', () => {
    let manager: PanZoomManager

    beforeEach(() => {
        manager = new PanZoomManager()
    })

    describe('initialization', () => {
        it('should not be initialized by default', () => {
            expect(manager.isInitialized()).toBe(false)
        })

        it('should initialize with an SVG element', () => {
            const svg = createMockSVG()
            manager.initialize(svg)
            expect(manager.isInitialized()).toBe(true)
        })
    })

    describe('zoom operations', () => {
        beforeEach(() => {
            const svg = createMockSVG()
            manager.initialize(svg)
        })

        it('should zoom in', () => {
            manager.zoomIn()
            // Since we're mocking, just verify no errors
            expect(manager.isInitialized()).toBe(true)
        })

        it('should zoom out', () => {
            manager.zoomOut()
            expect(manager.isInitialized()).toBe(true)
        })

        it('should reset zoom and pan', () => {
            manager.reset()
            expect(manager.isInitialized()).toBe(true)
        })

        it('should fit to view', () => {
            manager.fit()
            expect(manager.isInitialized()).toBe(true)
        })
    })

    describe('state management', () => {
        beforeEach(() => {
            const svg = createMockSVG()
            manager.initialize(svg)
        })

        it('should get current state', () => {
            const state = manager.getState()
            expect(state).toHaveProperty('zoom')
            expect(state).toHaveProperty('pan')
        })

        it('should set state', () => {
            const newState = {
                zoom: 2,
                pan: { x: 100, y: 50 }
            }
            manager.setState(newState)
            // Verify no errors thrown
            expect(manager.isInitialized()).toBe(true)
        })
    })

    describe('cleanup', () => {
        it('should destroy properly', () => {
            const svg = createMockSVG()
            manager.initialize(svg)
            manager.destroy()
            expect(manager.isInitialized()).toBe(false)
        })
    })
})
