import { getBoundsOfRects, getNodesBounds, type Node, type Rect } from 'reactflow';
import { toSvg } from 'html-to-image';
import type { CalloutSize } from '../../../context/DecisionOverlayContext.js';
import { calloutRects } from './labelPlacement.js';

export type ExportFormat = 'svg' | 'png';

const MARGIN = 40;
const PNG_SCALE = 2;
// The largest canvas Safari draws (4096 × 4096); larger canvases come out blank.
const MAX_CANVAS_AREA = 16_777_216;
const SVG_STYLES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'display', 'visibility'];

/** The area of the shown nodes and their decision callouts. */
export function diagramBounds(nodes: Node[], callouts: ReadonlyMap<string, CalloutSize>): Rect {
    const shown = nodes.filter((node) => !node.hidden);
    return calloutRects(shown, callouts).reduce(getBoundsOfRects, getNodesBounds(shown));
}

export function pngScale(width: number, height: number): number {
    return Math.min(PNG_SCALE, Math.sqrt(MAX_CANVAS_AREA / (width * height)));
}

export function exportFileName(viewportKey: string | undefined, format: ExportFormat): string {
    return `${viewportKey?.replaceAll('/', '-') ?? 'diagram'}.${format}`;
}

// html-to-image puts its own background on the moved diagram, so it would be moved too. This one covers the image.
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
    if (format === 'png') {
        save(await toPng(svg, width, height), fileName);
        return;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    save(url, fileName);
    URL.revokeObjectURL(url);
}

async function toPng(svg: string, width: number, height: number): Promise<string> {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const scale = pngScale(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

function save(href: string, fileName: string) {
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    link.click();
}
