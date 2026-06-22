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
 * Rasterizes the fixed SVG clone using the browser's native SVG image decoder rather
 * than an external library. The clone is loaded as a `data:` URI rather than a `blob:`
 * URL: Chromium currently taints the canvas when rasterizing an SVG containing a
 * <foreignObject> (which Mermaid uses for labels) loaded via a `blob:` URL, but `data:`
 * URIs have never tainted in any browser, independent of foreignObject content. The
 * clone is already self-contained - font-family is inlined as a literal value and
 * Mermaid's own <style> rules travel with it - so this needs no network access at all.
 */
export async function rasterizeSvgElementToPng(svg: SVGSVGElement, pixelRatio = 2): Promise<string> {
    const clone = buildExportClone(svg)
    const svgString = new XMLSerializer().serializeToString(clone)
    const width = parseFloat(clone.getAttribute('width') ?? '') || svg.clientWidth
    const height = parseFloat(clone.getAttribute('height') ?? '') || svg.clientHeight

    const dataUri = await svgStringToDataUri(svgString)
    const image = await loadImage(dataUri)

    const canvas = document.createElement('canvas')
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio

    const ctx = canvas.getContext('2d')
    if (!ctx) {
        throw new Error('Canvas 2D context unavailable')
    }
    // Canvas is transparent by default; without filling it first, the PNG has no
    // background and looks broken against anything but a white surface.
    const bgColor = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#ffffff'
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/png')
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

/**
 * Encodes via Blob + FileReader rather than `btoa(svgString)` directly - `btoa` throws
 * on any non-Latin1 character (e.g. an accented name in an architecture description),
 * while FileReader handles arbitrary Unicode and produces a base64 `data:` URI, which
 * has a bounded ~33% size overhead rather than the unpredictable blowup percent-encoding
 * gives XML-heavy content (every `<`, `>`, `"` becomes a 3-character escape).
 */
function svgStringToDataUri(svgString: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to encode SVG for rasterization'))
        reader.readAsDataURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }))
    })
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Failed to load SVG for rasterization'))
        image.src = src
    })
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
