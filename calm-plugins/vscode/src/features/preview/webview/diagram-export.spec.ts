// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('html-to-image', () => ({
    toPng: vi.fn(),
}))

import { toPng } from 'html-to-image'
import { serializeSvgElement, rasterizeSvgElementToPng, exportDiagram } from './diagram-export'

function createSvgElement(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '10')
    rect.setAttribute('height', '10')
    svg.appendChild(rect)
    return svg
}

/**
 * Mimics the DOM shape svg-pan-zoom leaves behind: a 100%-sized SVG with no viewBox,
 * wrapping the diagram content in a `.svg-pan-zoom_viewport` group carrying a pan/zoom
 * transform. `initializePanZoom` stashes Mermaid's own layout-computed viewBox as
 * `data-original-viewbox` before svg-pan-zoom strips it.
 */
function createPanZoomedSvgElement(originalViewBox: string | null): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement
    svg.setAttribute('width', '100%')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.overflow = 'hidden'

    if (originalViewBox) {
        svg.setAttribute('data-original-viewbox', originalViewBox)
    }

    const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    viewport.setAttribute('class', 'svg-pan-zoom_viewport')
    viewport.setAttribute('transform', 'matrix(0.23,0,0,0.23,0,223.88)')
    viewport.style.transform = 'matrix(0.23,0,0,0.23,0,223.88)'

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '10')
    rect.setAttribute('height', '10')
    viewport.appendChild(rect)
    svg.appendChild(viewport)

    return svg
}

describe('diagram-export', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('serializeSvgElement', () => {
        it('serializes the SVG including its children', () => {
            const svg = createSvgElement()
            const result = serializeSvgElement(svg)

            expect(result).toContain('<svg')
            expect(result).toContain('<rect')
            expect(result).toContain('width="10"')
        })

        it('adds an xmlns attribute when missing', () => {
            const svg = createSvgElement()
            expect(svg.getAttribute('xmlns')).toBeNull()

            const result = serializeSvgElement(svg)

            expect(result).toContain('xmlns="http://www.w3.org/2000/svg"')
        })

        it('does not duplicate an existing xmlns attribute', () => {
            const svg = createSvgElement()
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

            const result = serializeSvgElement(svg)

            expect(result.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)).toHaveLength(1)
        })

        it('sets the resolved font-family as a presentation attribute so text renders correctly standalone', () => {
            const svg = createSvgElement()
            svg.style.fontFamily = '-apple-system, BlinkMacSystemFont, Arial, sans-serif'

            const result = serializeSvgElement(svg)

            // Set as a presentation attribute (lowest CSS specificity), not via the style
            // attribute - the latter would override Mermaid's own font-family rules for
            // node/edge labels and change the text metrics they were sized for.
            expect(result).toContain('font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif"')
        })

        it('does not add a font-family attribute when none can be resolved', () => {
            const svg = createSvgElement()

            const result = serializeSvgElement(svg)

            expect(result).not.toContain('font-family')
        })

        it('restores Mermaid\'s original viewBox and drops the pan/zoom transform', () => {
            const svg = createPanZoomedSvgElement('4 4 1223.7734375 715')

            const result = serializeSvgElement(svg)

            expect(result).toContain('viewBox="4 4 1223.7734375 715"')
            expect(result).toContain('width="1223.7734375"')
            expect(result).toContain('height="715"')
            expect(result).not.toContain('transform="matrix')
            expect(result).not.toContain('data-original-viewbox')
            expect(result).not.toMatch(/style="[^"]*width:\s*100%/)
            expect(result).not.toMatch(/style="[^"]*height:\s*100%/)
        })

        it('does not add a viewBox when there is no pan-zoom viewport group', () => {
            const svg = createSvgElement()

            const result = serializeSvgElement(svg)

            expect(result).not.toContain('viewBox')
        })

        it('does not add a viewBox when there is no stashed original viewBox', () => {
            const svg = createPanZoomedSvgElement(null)

            const result = serializeSvgElement(svg)

            expect(result).not.toContain('viewBox')
            expect(result).toContain('transform="matrix')
        })

        it('sets overflow: visible on foreignObject elements so labels are not clipped', () => {
            const svg = createSvgElement()
            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
            foreignObject.setAttribute('width', '100')
            foreignObject.setAttribute('height', '20')
            svg.appendChild(foreignObject)

            const result = serializeSvgElement(svg)

            expect(result).toContain('<foreignObject width="100" height="20" style="overflow: visible;"/>')
        })

        it('does nothing when there are no foreignObject elements', () => {
            const svg = createSvgElement()

            const result = serializeSvgElement(svg)

            expect(result).not.toContain('overflow')
        })
    })

    describe('rasterizeSvgElementToPng', () => {
        it('strips the data URL prefix from the html-to-image result', async () => {
            vi.mocked(toPng).mockResolvedValue('data:image/png;base64,AAAA')

            const result = await rasterizeSvgElementToPng(createSvgElement())

            expect(result).toBe('AAAA')
            expect(toPng).toHaveBeenCalledWith(expect.anything(), { pixelRatio: 2 })
        })

        it('rasterizes an off-screen fixed clone rather than the live svg', async () => {
            const svg = createSvgElement()
            const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
            svg.appendChild(foreignObject)

            let wasAttached = false
            vi.mocked(toPng).mockImplementation(async (node) => {
                wasAttached = document.body.contains(node as unknown as Node)
                expect(node).not.toBe(svg)
                expect((node as unknown as Element).querySelector('foreignObject')?.getAttribute('style')).toContain('overflow: visible')
                return 'data:image/png;base64,AAAA'
            })

            await rasterizeSvgElementToPng(svg)

            expect(wasAttached).toBe(true)
        })

        it('removes the off-screen clone from the document after rasterizing, even on failure', async () => {
            vi.mocked(toPng).mockRejectedValue(new Error('boom'))
            const childCountBefore = document.body.childElementCount

            await expect(rasterizeSvgElementToPng(createSvgElement())).rejects.toThrow('boom')

            expect(document.body.childElementCount).toBe(childCountBefore)
        })
    })

    describe('exportDiagram', () => {
        it('returns an svg export message', async () => {
            const container = document.createElement('div')
            container.appendChild(createSvgElement())

            const message = await exportDiagram(container, 'svg', 1)

            expect(message.type).toBe('exportDiagram')
            expect(message.format).toBe('svg')
            expect(message.diagramIndex).toBe(1)
            expect(message.data).toContain('<svg')
        })

        it('returns a png export message using html-to-image', async () => {
            vi.mocked(toPng).mockResolvedValue('data:image/png;base64,QkJC')

            const container = document.createElement('div')
            container.appendChild(createSvgElement())

            const message = await exportDiagram(container, 'png', 2)

            expect(message.format).toBe('png')
            expect(message.diagramIndex).toBe(2)
            expect(message.data).toBe('QkJC')
        })

        it('throws when the container has no svg element', async () => {
            const container = document.createElement('div')

            await expect(exportDiagram(container, 'svg', 1)).rejects.toThrow('No SVG element found in diagram container')
        })
    })
})
