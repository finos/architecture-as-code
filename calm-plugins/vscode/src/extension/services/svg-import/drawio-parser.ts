import { parseStringPromise } from 'xml2js';
import { inflateRaw } from 'zlib';
import { promisify } from 'util';
import type { ParsedSvgGraph, SvgNode, SvgEdge, ShapeHint } from './types';

const inflateRawAsync = promisify(inflateRaw);

interface CellInfo {
    id: string;
    label: string;
    cellAttrs: Record<string, string>;
    wrapperAttrs: Record<string, string>;
    cell: Record<string, unknown>;
}

export async function parseDrawioSvg(svgContent: string): Promise<ParsedSvgGraph> {
    const mxXml = await extractMxGraphModel(svgContent);
    if (!mxXml) {
        return { nodes: [], edges: [], sourceFormat: 'drawio' };
    }

    const parsed = await parseStringPromise(mxXml, { explicitArray: false });
    const root = parsed?.mxGraphModel?.root;
    if (!root) return { nodes: [], edges: [], sourceFormat: 'drawio' };

    const allCells = collectAllCells(root);
    const vertexIds = new Set<string>();
    const nodes: SvgNode[] = [];
    const edges: SvgEdge[] = [];

    // First pass: collect vertex IDs
    for (const info of allCells) {
        if (info.cellAttrs.vertex === '1') {
            vertexIds.add(info.id);
        }
    }

    // Collect group IDs (these are container-only elements, not real nodes)
    const groupIds = new Set<string>();
    // Decorative parent IDs: groups with connectable=0 (legend boxes, decoration subtrees)
    const decorativeParentIds = new Set<string>();
    for (const info of allCells) {
        const style = info.cellAttrs.style ?? '';
        if (style.includes('group')) {
            groupIds.add(info.id);
            if (info.cellAttrs.connectable === '0') {
                decorativeParentIds.add(info.id);
            }
        }
    }

    // Second pass: extract nodes and edges
    for (const info of allCells) {
        if (info.id === '0' || info.id === '1') continue;
        // Skip children of decorative groups (legend items, visual-only elements)
        const parent = info.cellAttrs.parent ?? '';
        if (decorativeParentIds.has(parent)) continue;

        if (info.cellAttrs.vertex === '1') {
            const node = parseVertex(info, vertexIds);
            if (node) nodes.push(node);
        } else if (info.cellAttrs.edge === '1') {
            const edge = parseEdge(info, vertexIds);
            if (edge) edges.push(edge);
        }
    }

    // Remove parentId references to groups (since groups are skipped as nodes)
    for (const node of nodes) {
        if (node.parentId && groupIds.has(node.parentId)) {
            node.parentId = undefined;
        }
    }

    return { nodes, edges, sourceFormat: 'drawio' };
}

function collectAllCells(root: Record<string, unknown>): CellInfo[] {
    const results: CellInfo[] = [];

    // Direct mxCell elements
    for (const cell of normalizeArray(root.mxCell)) {
        const attrs = (cell.$ ?? {}) as Record<string, string>;
        results.push({
            id: attrs.id ?? '',
            label: attrs.value ?? '',
            cellAttrs: attrs,
            wrapperAttrs: {},
            cell,
        });
    }

    // object and UserObject wrappers (C4 elements, linked elements, etc.)
    for (const wrapperTag of ['object', 'UserObject']) {
        for (const wrapper of normalizeArray(root[wrapperTag])) {
            const wrapperAttrs = (wrapper.$ ?? {}) as Record<string, string>;
            const nestedCell = wrapper.mxCell as Record<string, unknown> | undefined;
            if (!nestedCell) continue;

            const cellAttrs = (nestedCell.$ ?? {}) as Record<string, string>;
            const id = wrapperAttrs.id ?? cellAttrs.id ?? '';
            const rawLabel = resolveLabel(wrapperAttrs);

            results.push({
                id,
                label: rawLabel,
                cellAttrs: { ...cellAttrs, id },
                wrapperAttrs,
                cell: nestedCell,
            });
        }
    }

    return results;
}

function resolveLabel(wrapperAttrs: Record<string, string>): string {
    const label = wrapperAttrs.label ?? '';

    // Only use Name/c4Name when the label actually contains placeholder patterns
    if (wrapperAttrs.placeholders === '1' && label.includes('%')) {
        const name = wrapperAttrs.Name ?? wrapperAttrs.c4Name ?? '';
        if (name && (label.includes('%Name%') || label.includes('%c4Name%'))) {
            const desc = wrapperAttrs.Description ?? wrapperAttrs.c4Description ?? '';
            return desc ? `${name}\n${desc}` : name;
        }
        // Resolve any %placeholder% patterns in the template
        return label.replace(/%([^%]+)%/g, (_, key: string) => {
            return wrapperAttrs[key] ?? '';
        });
    }

    // Label doesn't use placeholders — use it directly (may contain hardcoded HTML)
    return label;
}

async function extractMxGraphModel(svgContent: string): Promise<string | null> {
    // Method 1: content attribute on root SVG (most common in modern draw.io)
    const contentMatch = svgContent.match(/\bcontent="([^"]*)"/);
    if (contentMatch) {
        const decoded = decodeDrawioContent(contentMatch[1]!);
        const mxModel = extractMxGraphModelFromDecoded(decoded);
        if (mxModel) return mxModel;

        // Try decompression (some exports base64+deflate the diagram content)
        const decompressed = await tryDecompress(decoded);
        if (decompressed) {
            const mxFromDecompressed = extractMxGraphModelFromDecoded(decompressed);
            if (mxFromDecompressed) return mxFromDecompressed;
        }

        // The diagram element itself might hold compressed content
        const diagramContent = decoded.match(/<diagram[^>]*>([\s\S]*?)<\/diagram>/);
        if (diagramContent?.[1]) {
            const diagramDecompressed = await tryDecompress(diagramContent[1].trim());
            if (diagramDecompressed) {
                const mxFromDiagram = extractMxGraphModelFromDecoded(diagramDecompressed);
                if (mxFromDiagram) return mxFromDiagram;
            }
        }
    }

    // Method 2: Look for mxGraphModel directly in the SVG text (foreignObject or inline)
    const directMatch = svgContent.match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/);
    if (directMatch) return directMatch[0];

    return null;
}

function extractMxGraphModelFromDecoded(content: string): string | null {
    const match = content.match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/);
    return match?.[0] ?? null;
}

function decodeDrawioContent(content: string): string {
    // Try URL decoding first (older draw.io exports use %3C etc.)
    try {
        const urlDecoded = decodeURIComponent(content);
        if (urlDecoded !== content) return urlDecoded;
    } catch { /* not URL-encoded */ }

    // HTML entity decoding (modern draw.io / Confluence exports use &lt; &gt; &quot; &amp;)
    if (content.includes('&lt;') || content.includes('&amp;')) {
        return decodeHtmlEntities(content);
    }

    return content;
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;#xa;/g, '\n')
        .replace(/&amp;#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

async function tryDecompress(content: string): Promise<string | null> {
    try {
        let data = content;
        try { data = decodeURIComponent(data); } catch { /* already decoded */ }

        const buffer = Buffer.from(data, 'base64');
        if (buffer.length === 0) return null;

        const inflated = await inflateRawAsync(buffer);
        const result = inflated.toString('utf-8');

        try {
            const finalDecoded = decodeURIComponent(result);
            if (finalDecoded.includes('mxGraphModel')) return finalDecoded;
        } catch { /* not double-encoded */ }

        if (result.includes('mxGraphModel')) return result;
        return null;
    } catch {
        return null;
    }
}

function parseVertex(info: CellInfo, vertexIds: Set<string>): SvgNode | null {
    const { id, label: rawLabel, cellAttrs, cell } = info;
    const label = stripHtml(rawLabel);
    const style = cellAttrs.style ?? '';
    const styleProps = parseStyleString(style);

    // Skip group containers (they only serve as parent references)
    if (styleProps['group'] === '1') return null;
    // Skip connectable=0 elements (visual connectors, not real nodes)
    if (cellAttrs.connectable === '0') return null;
    // Skip text-only elements (labels, annotations, legend text)
    if (style.startsWith('text;') || style.includes(';text;')) return null;
    // Skip edge labels (annotations attached to edges)
    if (style.startsWith('edgeLabel;') || style.includes(';edgeLabel;')) return null;

    const shapeHint = classifyDrawioStyle(styleProps);
    const geometry = extractGeometry(cell);
    if (!geometry) return null;

    // Skip small unlabeled cells (legend swatches, decoration)
    if (!label && geometry.width <= 40 && geometry.height <= 40) return null;

    const parent = cellAttrs.parent ?? '1';
    const parentId = (parent !== '0' && parent !== '1' && vertexIds.has(parent))
        ? parent
        : undefined;

    return { id, label, shapeHint, geometry, parentId, styleProps };
}

function parseEdge(info: CellInfo, vertexIds: Set<string>): SvgEdge | null {
    const { id, label: rawLabel, cellAttrs } = info;
    const sourceId = cellAttrs.source ?? '';
    const targetId = cellAttrs.target ?? '';
    const label = stripHtml(rawLabel);

    if (!sourceId || !targetId) return null;
    if (!vertexIds.has(sourceId) || !vertexIds.has(targetId)) return null;

    return { id, sourceId, targetId, label: label || undefined };
}

function extractGeometry(cell: Record<string, unknown>): { x: number; y: number; width: number; height: number } | null {
    const geo = cell.mxGeometry as Record<string, unknown> | undefined;
    if (!geo) return null;

    const geoAttrs = (geo.$ ?? {}) as Record<string, string>;
    const x = parseFloat(geoAttrs.x ?? '0');
    const y = parseFloat(geoAttrs.y ?? '0');
    const width = parseFloat(geoAttrs.width ?? '0');
    const height = parseFloat(geoAttrs.height ?? '0');

    if (width === 0 && height === 0) return null;

    return { x, y, width, height };
}

export function parseStyleString(style: string): Record<string, string> {
    const props: Record<string, string> = {};
    for (const part of style.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            props[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
        } else {
            props[trimmed] = '1';
        }
    }
    return props;
}

export function classifyDrawioStyle(styleProps: Record<string, string>): ShapeHint {
    const shape = styleProps['shape'] ?? '';

    if (shape === 'cylinder' || shape === 'cylinder3') return 'cylinder';
    if (shape === 'actor' || shape.includes('general.user') || shape.includes('person')) return 'person';
    if (shape === 'cloud') return 'cloud';
    if (shape === 'hexagon') return 'hexagon';
    if (shape === 'rhombus') return 'diamond';
    if (shape === 'document' || shape === 'mxgraph.basic.document') return 'document';
    if (shape === 'parallelogram') return 'parallelogram';
    if (shape === 'ellipse' || styleProps['ellipse'] === '1') return 'ellipse';
    if (styleProps['rounded'] === '1') return 'rounded-rectangle';

    return 'rectangle';
}

function stripHtml(value: string): string {
    let result = value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:div|p|h[1-6]|li)>/gi, '\n')
        .replace(/<div[^>]*>/gi, '\n');

    // Loop to handle nested/split tags (e.g. <scr<b>ipt>)
    let prev = '';
    while (prev !== result) {
        prev = result;
        result = result.replace(/<[^>]*>/g, '');
    }

    return result
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function normalizeArray(val: unknown): Array<Record<string, unknown>> {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val as Record<string, unknown>];
}
