import { parse as parseSvg, type ElementNode, type TextNode } from 'svg-parser';
import type { ParsedSvgGraph, SvgNode, SvgEdge, ShapeHint, SvgNodeGeometry } from './types';

type HastNode = ElementNode | TextNode;

const MIN_SHAPE_SIZE = 20;
const EDGE_PROXIMITY_THRESHOLD = 15;

export function parseGenericSvg(svgContent: string): ParsedSvgGraph {
    const root = parseSvg(svgContent);
    const svg = findElement(root.children, 'svg');
    if (!svg) return { nodes: [], edges: [], sourceFormat: 'generic' };

    const nodes: SvgNode[] = [];
    const edges: SvgEdge[] = [];

    const svgTransform = parseTransform(String(svg.properties.transform ?? ''));
    extractNodesFromElement(svg, nodes, svgTransform);
    extractEdgesFromElement(svg, nodes, edges, svgTransform);
    detectContainment(nodes);

    return { nodes, edges, sourceFormat: 'generic' };
}

function findElement(children: HastNode[], tagName: string): ElementNode | null {
    for (const child of children) {
        if (child.type !== 'element') continue;
        if (child.tagName === tagName) return child;
        const found = findElement(child.children, tagName);
        if (found) return found;
    }
    return null;
}

interface Transform2D {
    tx: number;
    ty: number;
    sx: number;
    sy: number;
}

const IDENTITY_TRANSFORM: Transform2D = { tx: 0, ty: 0, sx: 1, sy: 1 };

function composeTransforms(outer: Transform2D, inner: Transform2D): Transform2D {
    return {
        sx: outer.sx * inner.sx,
        sy: outer.sy * inner.sy,
        tx: outer.sx * inner.tx + outer.tx,
        ty: outer.sy * inner.ty + outer.ty,
    };
}

function applyTransformToGeometry(geo: SvgNodeGeometry, accTransform: Transform2D, localTransform: Transform2D): void {
    const localX = localTransform.sx * geo.x + localTransform.tx;
    const localY = localTransform.sy * geo.y + localTransform.ty;
    geo.x = accTransform.sx * localX + accTransform.tx;
    geo.y = accTransform.sy * localY + accTransform.ty;
    geo.width = Math.abs(accTransform.sx * localTransform.sx) * geo.width;
    geo.height = Math.abs(accTransform.sy * localTransform.sy) * geo.height;
}

function extractNodesFromElement(
    element: ElementNode,
    nodes: SvgNode[],
    accTransform: Transform2D = IDENTITY_TRANSFORM
): void {
    const children = element.children;

    for (const child of children) {
        if (child.type !== 'element') continue;

        if (child.tagName === 'g') {
            const groupTransform = parseTransform(String(child.properties.transform ?? ''));
            const childTransform = composeTransforms(accTransform, groupTransform);
            const node = tryExtractNodeFromGroup(child, nodes.length, childTransform);
            if (node) {
                nodes.push(node);
            }
            extractNodesFromElement(child, nodes, childTransform);
        }
    }

    const capturedBounds = nodes.map(n => n.geometry);
    for (const child of children) {
        if (child.type !== 'element') continue;
        const tag = child.tagName;

        if (tag === 'rect' || tag === 'ellipse' || tag === 'circle') {
            const geo = getShapeGeometry(tag, child.properties);
            if (!geo || geo.width < MIN_SHAPE_SIZE || geo.height < MIN_SHAPE_SIZE) continue;

            const elTransform = parseTransform(String(child.properties.transform ?? ''));
            applyTransformToGeometry(geo, accTransform, elTransform);

            if (overlapsExisting(geo, capturedBounds)) continue;

            const label = findNearbyTextInElement(element, geo);
            const id = String(child.properties.id ?? `node-${nodes.length}`);
            nodes.push({
                id,
                label: label ?? '',
                shapeHint: classifyTag(tag, child.properties),
                geometry: geo,
                styleProps: {},
            });
            capturedBounds.push(geo);
        }
    }
}

function tryExtractNodeFromGroup(
    g: ElementNode,
    index: number,
    accTransform: Transform2D
): SvgNode | null {
    let shapeGeo: SvgNodeGeometry | null = null;
    let shapeHint: ShapeHint = 'unknown';
    let label = '';

    let shapeTransform: Transform2D = IDENTITY_TRANSFORM;

    for (const child of g.children) {
        if (child.type !== 'element') continue;
        const tag = child.tagName;

        if ((tag === 'rect' || tag === 'ellipse' || tag === 'circle') && !shapeGeo) {
            shapeGeo = getShapeGeometry(tag, child.properties);
            shapeHint = classifyTag(tag, child.properties);
            shapeTransform = parseTransform(String(child.properties.transform ?? ''));
        }

        if (tag === 'text' && !label) {
            label = extractTextContent(child);
        }
    }

    if (!shapeGeo || shapeGeo.width < MIN_SHAPE_SIZE || shapeGeo.height < MIN_SHAPE_SIZE) {
        return null;
    }

    applyTransformToGeometry(shapeGeo, accTransform, shapeTransform);

    const id = String(g.properties.id ?? `node-${index}`);
    return { id, label, shapeHint, geometry: shapeGeo, styleProps: {} };
}

function applyPoint(point: { x: number; y: number }, t: Transform2D): { x: number; y: number } {
    return { x: t.sx * point.x + t.tx, y: t.sy * point.y + t.ty };
}

function extractEdgesFromElement(
    element: ElementNode,
    nodes: SvgNode[],
    edges: SvgEdge[],
    accTransform: Transform2D = IDENTITY_TRANSFORM
): void {
    for (const child of element.children) {
        if (child.type !== 'element') continue;
        const tag = child.tagName;
        const props = child.properties;
        const elTransform = composeTransforms(accTransform, parseTransform(String(props.transform ?? '')));

        if (tag === 'line') {
            const edge = tryMatchLine(props, nodes, edges.length, elTransform);
            if (edge) edges.push(edge);
        } else if (tag === 'polyline') {
            const points = String(props.points ?? '');
            const coords = points.split(/\s+/).map(p => p.split(',').map(Number));
            if (coords.length >= 2) {
                const start = applyPoint({ x: coords[0]![0]!, y: coords[0]![1]! }, elTransform);
                const end = applyPoint({ x: coords[coords.length - 1]![0]!, y: coords[coords.length - 1]![1]! }, elTransform);
                const source = findNearestNode(start, nodes);
                const target = findNearestNode(end, nodes);
                if (source && target && source !== target) {
                    edges.push({
                        id: String(props.id ?? `edge-${edges.length}`),
                        sourceId: source.id,
                        targetId: target.id,
                    });
                }
            }
        } else if (tag === 'g') {
            extractEdgesFromElement(child, nodes, edges, elTransform);
        }
    }
}

function tryMatchLine(props: Record<string, string | number>, nodes: SvgNode[], index: number, transform: Transform2D = IDENTITY_TRANSFORM): SvgEdge | null {
    const x1 = parseFloat(String(props.x1 ?? ''));
    const y1 = parseFloat(String(props.y1 ?? ''));
    const x2 = parseFloat(String(props.x2 ?? ''));
    const y2 = parseFloat(String(props.y2 ?? ''));

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return null;

    const start = applyPoint({ x: x1, y: y1 }, transform);
    const end = applyPoint({ x: x2, y: y2 }, transform);
    const source = findNearestNode(start, nodes);
    const target = findNearestNode(end, nodes);

    if (!source || !target || source === target) return null;

    return {
        id: String(props.id ?? `edge-${index}`),
        sourceId: source.id,
        targetId: target.id,
    };
}

function findNearestNode(point: { x: number; y: number }, nodes: SvgNode[]): SvgNode | null {
    let closest: SvgNode | null = null;
    let minDist = EDGE_PROXIMITY_THRESHOLD;
    let minArea = Infinity;

    for (const node of nodes) {
        const dist = distanceToNodeBorder(point, node.geometry);
        const area = node.geometry.width * node.geometry.height;

        if (dist < minDist) {
            minDist = dist;
            closest = node;
            minArea = area;
        } else if (dist === 0 && minDist === 0 && area < minArea) {
            closest = node;
            minArea = area;
        }
    }

    return closest;
}

function distanceToNodeBorder(point: { x: number; y: number }, geo: SvgNodeGeometry): number {
    const { x, y, width, height } = geo;

    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
        return 0;
    }

    const nearestX = Math.max(x, Math.min(point.x, x + width));
    const nearestY = Math.max(y, Math.min(point.y, y + height));

    return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}

function detectContainment(nodes: SvgNode[]): void {
    const byArea = [...nodes].sort((a, b) => {
        const aArea = a.geometry.width * a.geometry.height;
        const bArea = b.geometry.width * b.geometry.height;
        return aArea - bArea;
    });

    for (const child of nodes) {
        if (child.parentId) continue;
        for (const parent of byArea) {
            if (parent.id === child.id) continue;
            if (parent.parentId === child.id) continue;
            if (isFullyContained(child.geometry, parent.geometry)) {
                child.parentId = parent.id;
                break;
            }
        }
    }

    const absoluteGeo = new Map(nodes.map(n => [n.id, { ...n.geometry }]));
    for (const child of nodes) {
        if (!child.parentId) continue;
        const parentGeo = absoluteGeo.get(child.parentId);
        if (!parentGeo) continue;
        child.geometry = {
            ...child.geometry,
            x: child.geometry.x - parentGeo.x,
            y: child.geometry.y - parentGeo.y,
        };
    }
}

function isFullyContained(inner: SvgNodeGeometry, outer: SvgNodeGeometry): boolean {
    const margin = 5;
    return (
        inner.x >= outer.x + margin &&
        inner.y >= outer.y + margin &&
        inner.x + inner.width <= outer.x + outer.width - margin &&
        inner.y + inner.height <= outer.y + outer.height - margin
    );
}

function parseTransform(transform: string | undefined): Transform2D {
    if (!transform) return IDENTITY_TRANSFORM;

    const fnPattern = /(translate|scale|matrix)\(([^)]+)\)/g;
    let result = IDENTITY_TRANSFORM;
    let matched = false;
    let m: RegExpExecArray | null;

    while ((m = fnPattern.exec(transform)) !== null) {
        matched = true;
        const fn = m[1];
        const args = m[2]!.split(/[\s,]+/).map(Number);
        let step: Transform2D;

        switch (fn) {
            case 'translate':
                step = { tx: args[0] ?? 0, ty: args[1] ?? 0, sx: 1, sy: 1 };
                break;
            case 'scale': {
                const sx = args[0] ?? 1;
                step = { tx: 0, ty: 0, sx, sy: args[1] ?? sx };
                break;
            }
            case 'matrix': {
                const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = args;
                if (Math.abs(b) < 0.001 && Math.abs(c) < 0.001) {
                    step = { sx: a, sy: d, tx: e, ty: f };
                } else {
                    step = { sx: Math.sqrt(a * a + b * b), sy: Math.sqrt(c * c + d * d), tx: e, ty: f };
                }
                break;
            }
            default:
                continue;
        }

        result = composeTransforms(result, step);
    }

    return matched ? result : IDENTITY_TRANSFORM;
}

function getShapeGeometry(tag: string, props: Record<string, string | number>): SvgNodeGeometry | null {
    switch (tag) {
        case 'rect': {
            const x = parseFloat(String(props.x ?? '0'));
            const y = parseFloat(String(props.y ?? '0'));
            const width = parseFloat(String(props.width ?? '0'));
            const height = parseFloat(String(props.height ?? '0'));
            if (width === 0 || height === 0) return null;
            return { x, y, width, height };
        }
        case 'ellipse': {
            const cx = parseFloat(String(props.cx ?? '0'));
            const cy = parseFloat(String(props.cy ?? '0'));
            const rx = parseFloat(String(props.rx ?? '0'));
            const ry = parseFloat(String(props.ry ?? '0'));
            if (rx === 0 || ry === 0) return null;
            return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
        }
        case 'circle': {
            const cx = parseFloat(String(props.cx ?? '0'));
            const cy = parseFloat(String(props.cy ?? '0'));
            const r = parseFloat(String(props.r ?? '0'));
            if (r === 0) return null;
            return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
        }
        default:
            return null;
    }
}

function classifyTag(tag: string, props: Record<string, string | number>): ShapeHint {
    switch (tag) {
        case 'ellipse':
        case 'circle':
            return 'ellipse';
        case 'rect': {
            const rx = parseFloat(String(props.rx ?? '0'));
            return rx > 0 ? 'rounded-rectangle' : 'rectangle';
        }
        default:
            return 'unknown';
    }
}

function extractTextContent(textEl: ElementNode): string {
    const parts: string[] = [];

    for (const child of textEl.children) {
        if (child.type === 'text' && child.value) {
            parts.push(child.value);
        } else if (child.type === 'element' && child.tagName === 'tspan') {
            const tspanText = extractTextContent(child);
            if (tspanText) parts.push(tspanText);
        }
    }

    return parts.join(' ').trim();
}

function findNearbyTextInElement(element: ElementNode, geo: SvgNodeGeometry): string | null {
    const cx = geo.x + geo.width / 2;
    const cy = geo.y + geo.height / 2;
    const threshold = Math.max(geo.width, geo.height);

    let bestLabel: string | null = null;
    let bestDist = threshold;

    for (const child of element.children) {
        if (child.type !== 'element' || child.tagName !== 'text') continue;
        const props = child.properties;
        const tx = parseFloat(String(props.x ?? '0'));
        const ty = parseFloat(String(props.y ?? '0'));
        const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
        if (dist < bestDist) {
            bestDist = dist;
            bestLabel = extractTextContent(child);
        }
    }
    return bestLabel;
}

function overlapsExisting(geo: SvgNodeGeometry, existing: SvgNodeGeometry[]): boolean {
    for (const e of existing) {
        if (Math.abs(geo.x - e.x) < 2 && Math.abs(geo.y - e.y) < 2 &&
            Math.abs(geo.width - e.width) < 2 && Math.abs(geo.height - e.height) < 2) {
            return true;
        }
    }
    return false;
}
