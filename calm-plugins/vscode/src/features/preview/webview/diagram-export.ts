import { toPng } from 'html-to-image'

export type DiagramExportFormat = 'svg' | 'png'

export interface DiagramExportMessage {
    type: 'exportDiagram'
    format: DiagramExportFormat
    data: string
    diagramIndex: number
}

export function serializeSvgElement(svg: SVGSVGElement): string {
    const clone = buildExportClone(svg)
    return new XMLSerializer().serializeToString(clone)
}

/**
 * Produces a detached clone of `svg` ready for export, with three fixes applied:
 *
 * Font: some text (e.g. edge labels) inherits the webview body font rather than getting
 * an explicit font-family from Mermaid's styles. That inheritance breaks in a standalone
 * file, so the live resolved font-family is inlined as a presentation attribute (lowest
 * CSS specificity, so it doesn't override Mermaid's own per-element font rules).
 *
 * ViewBox: svg-pan-zoom strips the viewBox and wraps content in a pan/zoom transform.
 * `initializePanZoom` stashes Mermaid's original layout viewBox as `data-original-viewbox`
 * before svg-pan-zoom removes it; restore that here along with explicit width/height so
 * the file has correct intrinsic dimensions and shows the whole diagram.
 *
 * Clipping: the inlined font may render glyphs wider than the font Mermaid used when
 * measuring foreignObject sizes, causing labels to overflow. foreignObjects clip by
 * default; set overflow:visible so any overflow spills out rather than being cut off.
 */
function buildExportClone(svg: SVGSVGElement): SVGSVGElement {
    const clone = svg.cloneNode(true) as SVGSVGElement
    // Remove any explicit xmlns - the serializer adds its own, and keeping both
    // produces a duplicated attribute, making the output invalid XML.
    clone.removeAttribute('xmlns')

    // Font
    const fontFamily = getComputedStyle(svg).fontFamily
    if (fontFamily) {
        clone.setAttribute('font-family', fontFamily)
    }

    // ViewBox
    const originalViewBox = clone.getAttribute('data-original-viewbox')
    const viewport = clone.querySelector('.svg-pan-zoom_viewport') as SVGElement | null
    if (originalViewBox && viewport) {
        const [, , width, height] = originalViewBox.split(/\s+/)
        clone.setAttribute('viewBox', originalViewBox)
        clone.setAttribute('width', width)
        clone.setAttribute('height', height)
        clone.removeAttribute('data-original-viewbox')
        clone.style.removeProperty('width')
        clone.style.removeProperty('height')
        viewport.removeAttribute('transform')
        viewport.style.removeProperty('transform')
    }

    // Clipping
    clone.querySelectorAll('foreignObject').forEach((fo) => {
        fo.style.overflow = 'visible'
    })

    return clone
}

/**
 * Rasterizing the live SVG directly would reproduce the same clipped labels as the
 * unfixed export (the live SVG is also missing Mermaid's original viewBox, since
 * svg-pan-zoom strips it). Build the same fixed clone used for SVG export and render
 * it off-screen so html-to-image can compute its layout and styles before rasterizing.
 */
export async function rasterizeSvgElementToPng(svg: SVGSVGElement): Promise<string> {
    const clone = buildExportClone(svg)

    // Render the clone off-screen so html-to-image can compute its layout and styles
    // before rasterizing, without disturbing the visible page. The positioning goes on
    // a wrapper, not the clone itself - html-to-image inlines the clone's own computed
    // style onto its internal copy, and `position: fixed; left: -99999px` on the clone
    // would carry over and render its content off-canvas, producing a blank image.
    const offscreen = document.createElement('div')
    offscreen.style.position = 'fixed'
    offscreen.style.left = '-99999px'
    offscreen.style.top = '0'
    offscreen.appendChild(clone)
    document.body.appendChild(offscreen)

    try {
        const dataUrl = await toPng(clone as unknown as HTMLElement, { pixelRatio: 2 })
        return dataUrl.slice(dataUrl.indexOf(',') + 1)
    } finally {
        offscreen.remove()
    }
}

export async function exportDiagram(
    container: HTMLElement,
    format: DiagramExportFormat,
    diagramIndex: number
): Promise<DiagramExportMessage> {
    const svg = container.querySelector('svg')
    if (!svg) {
        throw new Error('No SVG element found in diagram container')
    }
    const data = format === 'svg'
        ? serializeSvgElement(svg as unknown as SVGSVGElement)
        : await rasterizeSvgElementToPng(svg as unknown as SVGSVGElement)
    return { type: 'exportDiagram', format, data, diagramIndex }
}
