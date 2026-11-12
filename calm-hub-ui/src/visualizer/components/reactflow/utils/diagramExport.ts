import { getBoundsOfRects, getNodesBounds, type Node, type Rect } from 'reactflow';
import { toSvg } from 'html-to-image';
import type { CalloutSize } from '../../../context/DecisionOverlayContext.js';
import { calloutRects } from './labelPlacement.js';

export type ExportFormat = 'svg' | 'png';

const MARGIN = 40;
const PNG_SCALE = 2;
// The largest canvas every browser draws, by area (Safari) and by side; a larger one comes out blank.
const MAX_CANVAS_AREA = 16_777_216;
const MAX_CANVAS_SIDE = 16_384;
const SVG_STYLES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'display', 'visibility'];

/** The area of the shown nodes and their decision callouts. */
export function diagramBounds(nodes: Node[], callouts: ReadonlyMap<string, CalloutSize>): Rect {
    const shown = nodes.filter((node) => !node.hidden);
    return calloutRects(shown, callouts).reduce(getBoundsOfRects, getNodesBounds(shown));
}

/**
 * The drawn edge labels and decision callouts, in flow units. A label can reach past the nodes, for example above a
 * top-row node in presentation mode. A hidden label measures 0 and is left out.
 */
export function labelRects(viewport: HTMLElement, zoom: number): Rect[] {
    const origin = viewport.getBoundingClientRect();
    return [...viewport.querySelectorAll('.react-flow__edgelabel-renderer > *')]
        .map((label) => label.getBoundingClientRect())
        .filter((rect) => rect.width && rect.height)
        .map((rect) => ({
            x: (rect.left - origin.left) / zoom,
            y: (rect.top - origin.top) / zoom,
            width: rect.width / zoom,
            height: rect.height / zoom,
        }));
}

export function pngScale(width: number, height: number): number {
    return Math.min(PNG_SCALE, Math.sqrt(MAX_CANVAS_AREA / (width * height)), MAX_CANVAS_SIDE / Math.max(width, height));
}

export function exportFileName(viewportKey: string | undefined, format: ExportFormat): string {
    return `${viewportKey?.replaceAll('/', '-') ?? 'diagram'}.${format}`;
}

/** html-to-image puts its own background on the moved diagram, so it would be moved too. This one covers the image. */
export function withBackground(svg: string, color: string): string {
    const end = svg.indexOf('>', svg.indexOf('<svg')) + 1;
    return `${svg.slice(0, end)}<rect width="100%" height="100%" fill="${color}"/>${svg.slice(end)}`;
}

/**
 * html-to-image copies an inline SVG, such as an edge, without the styles it gets from style sheets, so a curve with
 * `fill: none` comes out filled black. This copies those styles from the drawn diagram into the image.
 */
export function withSvgStyles(svg: string, viewport: HTMLElement): string {
    const image = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const copies = image.querySelectorAll<SVGElement>('svg svg *');
    const drawn = viewport.querySelectorAll('svg *');
    if (copies.length !== drawn.length) return svg;
    drawn.forEach((element, index) => {
        const style = getComputedStyle(element);
        SVG_STYLES.forEach((name) => copies[index].style.setProperty(name, style.getPropertyValue(name)));
    });
    return new XMLSerializer().serializeToString(image);
}

/** Saves the diagram in the React Flow viewport element, cut to `bounds`, as an image file. */
export async function exportDiagram(
    viewport: HTMLElement,
    bounds: Rect,
    format: ExportFormat,
    fileName: string,
    background: string,
): Promise<void> {
    const width = Math.ceil(bounds.width + MARGIN * 2);
    const height = Math.ceil(bounds.height + MARGIN * 2);
    const options = {
        width,
        height,
        style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${MARGIN - bounds.x}px, ${MARGIN - bounds.y}px)`,
        },
    };
    const dataUrl = await toSvg(viewport, options);
    const svg = withBackground(withSvgStyles(decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1)), viewport), background);
    const blob = format === 'png' ? await toPng(svg, width, height) : new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    save(url, fileName);
    URL.revokeObjectURL(url);
}

async function toPng(svg: string, width: number, height: number): Promise<Blob> {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const scale = pngScale(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The canvas made no PNG'))), 'image/png'),
    );
}

function save(href: string, fileName: string) {
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    link.click();
}
