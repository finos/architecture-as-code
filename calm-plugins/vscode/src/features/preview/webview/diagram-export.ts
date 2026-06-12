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
 * Produces a detached clone of `svg` with the same fixes applied to both the SVG and
 * PNG export paths: an inlined font-family, Mermaid's original viewBox restored, and
 * foreignObjects that won't clip their labels.
 */
function buildExportClone(svg: SVGSVGElement): SVGSVGElement {
    const clone = svg.cloneNode(true) as SVGSVGElement
    // Remove any explicit xmlns attribute - the serializer adds its own namespace
    // declaration based on namespaceURI, and keeping both produces invalid XML
    // with a duplicated xmlns attribute.
    clone.removeAttribute('xmlns')

    inlineResolvedFont(svg, clone)
    restoreDiagramViewBox(clone)
    preventForeignObjectClipping(clone)

    return clone
}

/**
 * Some text (e.g. edge labels) doesn't get a font-family from Mermaid's embedded styles
 * and instead relies on inheriting the page's body font (e.g. VS Code's webview font).
 * That ancestor CSS isn't available to a standalone SVG file, so this text falls back to
 * the renderer's default font (often serif). Set the live, fully-resolved font-family as
 * a presentation attribute on the root element - this has the lowest CSS specificity, so
 * it provides a fallback for unstyled text without overriding Mermaid's own font-family
 * rules for node/edge labels (which Mermaid used when sizing their foreignObjects -
 * overriding them would change text metrics and cause labels to be clipped).
 */
function inlineResolvedFont(source: SVGSVGElement, clone: SVGSVGElement): void {
    const fontFamily = getComputedStyle(source).fontFamily
    if (fontFamily) {
        clone.setAttribute('font-family', fontFamily)
    }
}

/**
 * svg-pan-zoom strips the SVG's viewBox, sizes it to 100% of its container, and wraps
 * the diagram in a `.svg-pan-zoom_viewport` group carrying the live pan/zoom transform.
 * Serialized as-is, the result has no intrinsic size and shows whatever portion of the
 * diagram the user last panned/zoomed to. `initializePanZoom` stashes Mermaid's own
 * layout-computed viewBox - which already accounts for every label, edge label and
 * subgraph - as `data-original-viewbox` before svg-pan-zoom strips it. Restore that
 * viewBox and drop the pan/zoom transform so the exported file renders the whole
 * diagram exactly as Mermaid laid it out.
 */
function restoreDiagramViewBox(clone: SVGSVGElement): void {
    const originalViewBox = clone.getAttribute('data-original-viewbox')
    const viewport = clone.querySelector('.svg-pan-zoom_viewport') as SVGElement | null
    if (!originalViewBox || !viewport) {
        return
    }

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

/**
 * `inlineResolvedFont`'s font-family can render glyphs (e.g. emoji) at a different
 * width in whatever renderer later opens the exported file than in the font Mermaid
 * used when it measured each label's `<foreignObject>` here in the webview - so a
 * label that fits here can still overflow its foreignObject elsewhere. A foreignObject
 * clips overflowing content by default; set `overflow: visible` so any such overflow
 * spills visibly instead of being cut off, regardless of which renderer opens the file.
 */
function preventForeignObjectClipping(clone: SVGSVGElement): void {
    clone.querySelectorAll('foreignObject').forEach((foreignObject) => {
        foreignObject.style.overflow = 'visible'
    })
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
