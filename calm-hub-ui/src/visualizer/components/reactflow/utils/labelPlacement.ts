import type { Rect } from 'reactflow';
import type { CalloutSize } from '../../../context/DecisionOverlayContext.js';

/** The space left between a moved edge label and the callout above it. */
const CALLOUT_CLEARANCE = 8;

interface PlacedNode {
    id: string;
    type?: string;
    width?: number | null;
    height?: number | null;
    positionAbsolute?: { x: number; y: number };
}

/**
 * The top edge of the node an edge label at (x, y) would cover, or undefined when it covers none. Only drawn nodes
 * count, not the group containers around them, and not the edge's own ends. Presentation mode lifts a label above
 * such a node, so the larger label does not hide the node's own label.
 */
export function coveredNodeTop(
    nodes: Iterable<PlacedNode>,
    x: number,
    y: number,
    ends: string[],
): number | undefined {
    for (const node of nodes) {
        if (node.type !== 'custom' || ends.includes(node.id)) continue;
        const { positionAbsolute: p, width, height } = node;
        if (!p || !width || !height) continue;
        if (x >= p.x && x <= p.x + width && y >= p.y && y <= p.y + height) return p.y;
    }
    return undefined;
}

/**
 * The area each decision callout covers, in flow units: from the bottom of its node to the bottom of the callout. A
 * node with no reported callout, or not yet measured, has none.
 */
export function calloutRects(nodes: Iterable<PlacedNode>, sizes: ReadonlyMap<string, CalloutSize>): Rect[] {
    const rects: Rect[] = [];
    for (const node of nodes) {
        const size = sizes.get(node.id);
        const { positionAbsolute: p, height } = node;
        if (!size || !p || !height) continue;
        rects.push({ x: p.x, y: p.y + height, width: size.width, height: size.height });
    }
    return rects;
}

/**
 * How far to move an edge label down so it clears the callouts it would cover, or 0 when it covers none. It is
 * calculated from the label's own position, so the result does not feed back into the next calculation.
 */
export function calloutShift(label: Rect, callouts: Iterable<Rect>): number {
    let shift = 0;
    for (const c of callouts) {
        const overlaps = label.x < c.x + c.width && label.x + label.width > c.x
            && label.y < c.y + c.height && label.y + label.height > c.y;
        if (overlaps) shift = Math.max(shift, c.y + c.height + CALLOUT_CLEARANCE - label.y);
    }
    return shift;
}
