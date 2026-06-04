import { describe, it, expect } from 'vitest';
import { Node, Edge } from 'reactflow';
import {
    getLayoutedElements,
    createTopLevelLayout,
    calculateChildBounds,
    sortContainersDeepestFirst,
    getNodeWidth,
    getNodeHeight,
    reflowContainersToFitChildren,
} from './layoutUtils';
import { GRAPH_LAYOUT } from './constants';

const PAD = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;
const W = GRAPH_LAYOUT.NODE_WIDTH;
const H = GRAPH_LAYOUT.NODE_HEIGHT;

describe('getLayoutedElements', () => {
    it('returns empty arrays for empty input', () => {
        const result = getLayoutedElements([], []);
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
    });

    it('assigns positions to nodes', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
        ];
        const edges: Edge[] = [];
        const result = getLayoutedElements(nodes, edges);

        expect(result.nodes).toHaveLength(2);
        expect(result.nodes[0].position).toBeDefined();
        expect(typeof result.nodes[0].position.x).toBe('number');
        expect(typeof result.nodes[0].position.y).toBe('number');
    });

    it('preserves node data', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'Test', custom: 'value' } },
        ];
        const result = getLayoutedElements(nodes, []);

        expect(result.nodes[0].data.label).toBe('Test');
        expect(result.nodes[0].data.custom).toBe('value');
    });

    it('preserves node id', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        ];
        const result = getLayoutedElements(nodes, []);

        expect(result.nodes[0].id).toBe('node-1');
    });

    it('returns edges unchanged', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
        ];
        const edges: Edge[] = [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ];
        const result = getLayoutedElements(nodes, edges);

        expect(result.edges).toEqual(edges);
    });

    it('positions connected nodes in sequence', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-3', position: { x: 0, y: 0 }, data: {} },
        ];
        const edges: Edge[] = [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
            { id: 'edge-2', source: 'node-2', target: 'node-3' },
        ];
        const result = getLayoutedElements(nodes, edges);

        // With LR layout, x positions should increase
        const node1 = result.nodes.find((n) => n.id === 'node-1')!;
        const node2 = result.nodes.find((n) => n.id === 'node-2')!;
        const node3 = result.nodes.find((n) => n.id === 'node-3')!;

        expect(node1.position.x).toBeLessThan(node2.position.x);
        expect(node2.position.x).toBeLessThan(node3.position.x);
    });
});

describe('getNodeWidth / getNodeHeight', () => {
    it('falls back to standard dimensions when none are set', () => {
        const node: Node = { id: 'n', position: { x: 0, y: 0 }, data: {} };
        expect(getNodeWidth(node)).toBe(GRAPH_LAYOUT.NODE_WIDTH);
        expect(getNodeHeight(node)).toBe(GRAPH_LAYOUT.NODE_HEIGHT);
    });

    it('prefers an explicit width/height over style', () => {
        const node: Node = {
            id: 'n',
            position: { x: 0, y: 0 },
            data: {},
            width: 500,
            height: 400,
            style: { width: 999, height: 999 },
        };
        expect(getNodeWidth(node)).toBe(500);
        expect(getNodeHeight(node)).toBe(400);
    });

    it('reads dimensions from style when width/height are absent', () => {
        const node: Node = {
            id: 'n',
            position: { x: 0, y: 0 },
            data: {},
            style: { width: 320, height: 210 },
        };
        expect(getNodeWidth(node)).toBe(320);
        expect(getNodeHeight(node)).toBe(210);
    });
});

describe('calculateChildBounds', () => {
    it('respects a child container\'s actual dimensions', () => {
        const children: Node[] = [
            { id: 'big', position: { x: 0, y: 0 }, data: {}, width: 600, height: 400 },
        ];
        const bounds = calculateChildBounds(children);
        expect(bounds.maxX).toBe(600);
        expect(bounds.maxY).toBe(400);
    });

    it('uses standard dimensions for plain nodes', () => {
        const children: Node[] = [{ id: 'leaf', position: { x: 10, y: 20 }, data: {} }];
        const bounds = calculateChildBounds(children);
        expect(bounds.minX).toBe(10);
        expect(bounds.minY).toBe(20);
        expect(bounds.maxX).toBe(10 + GRAPH_LAYOUT.NODE_WIDTH);
        expect(bounds.maxY).toBe(20 + GRAPH_LAYOUT.NODE_HEIGHT);
    });
});

describe('sortContainersDeepestFirst', () => {
    it('orders inner containers before their parents', () => {
        const containers: Node[] = [
            { id: 'outer', position: { x: 0, y: 0 }, data: {} },
            { id: 'inner', position: { x: 0, y: 0 }, data: {}, parentId: 'outer' },
            { id: 'innermost', position: { x: 0, y: 0 }, data: {}, parentId: 'inner' },
        ];
        const order = sortContainersDeepestFirst(containers).map((n) => n.id);
        expect(order.indexOf('innermost')).toBeLessThan(order.indexOf('inner'));
        expect(order.indexOf('inner')).toBeLessThan(order.indexOf('outer'));
    });

    it('does not mutate the input array', () => {
        const containers: Node[] = [
            { id: 'inner', position: { x: 0, y: 0 }, data: {}, parentId: 'outer' },
            { id: 'outer', position: { x: 0, y: 0 }, data: {} },
        ];
        const before = containers.map((n) => n.id);
        sortContainersDeepestFirst(containers);
        expect(containers.map((n) => n.id)).toEqual(before);
    });
});

describe('reflowContainersToFitChildren', () => {
    it('hugs a child with equal padding on all sides, preserving on-screen position', () => {
        const nodes: Node[] = [
            { id: 'box', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'child', type: 'custom', parentId: 'box', position: { x: 300, y: 220 }, data: {} },
        ];
        const result = reflowContainersToFitChildren(nodes);
        const box = result.find((n) => n.id === 'box')!;
        const child = result.find((n) => n.id === 'child')!;
        // Child is pulled to the padding offset; the box shifts to keep it on-screen.
        expect(child.position).toEqual({ x: PAD, y: PAD });
        expect(box.position.x + child.position.x).toBe(0 + 300);
        expect(box.position.y + child.position.y).toBe(0 + 220);
        expect(box.width).toBe(W + 2 * PAD);
        expect(box.height).toBe(H + 2 * PAD);
    });

    it('shrinks a previously-grown box back to hug its children', () => {
        const nodes: Node[] = [
            {
                id: 'box',
                type: 'group',
                position: { x: 0, y: 0 },
                data: {},
                width: 2000,
                height: 2000,
                style: { width: 2000, height: 2000 },
            },
            { id: 'a', type: 'custom', parentId: 'box', position: { x: 400, y: 300 }, data: {} },
            { id: 'b', type: 'custom', parentId: 'box', position: { x: 700, y: 520 }, data: {} },
        ];
        const result = reflowContainersToFitChildren(nodes);
        const box = result.find((n) => n.id === 'box')!;
        const a = result.find((n) => n.id === 'a')!;
        const b = result.find((n) => n.id === 'b')!;
        // Leftmost/topmost child sits at the padding offset; box tightly fits both.
        expect(Math.min(a.position.x, b.position.x)).toBe(PAD);
        expect(Math.min(a.position.y, b.position.y)).toBe(PAD);
        expect(box.width).toBe(Math.max(a.position.x, b.position.x) + W + PAD);
        expect(box.height).toBe(Math.max(a.position.y, b.position.y) + H + PAD);
        expect(box.width as number).toBeLessThan(2000);
        expect(box.height as number).toBeLessThan(2000);
    });

    it('shifts the origin to enclose a child dragged above/left, preserving on-screen position', () => {
        const nodes: Node[] = [
            { id: 'box', type: 'group', position: { x: 1000, y: 1000 }, data: {} },
            { id: 'child', type: 'custom', parentId: 'box', position: { x: -50, y: -30 }, data: {} },
        ];
        const absX = 1000 - 50;
        const absY = 1000 - 30;
        const result = reflowContainersToFitChildren(nodes);
        const box = result.find((n) => n.id === 'box')!;
        const child = result.find((n) => n.id === 'child')!;
        const shiftX = PAD + 50;
        const shiftY = PAD + 30;
        // Child reclaims its top/left padding; container origin moves to compensate.
        expect(child.position).toEqual({ x: PAD, y: PAD });
        expect(box.position).toEqual({ x: 1000 - shiftX, y: 1000 - shiftY });
        // On-screen (absolute) position is unchanged.
        expect(box.position.x + child.position.x).toBe(absX);
        expect(box.position.y + child.position.y).toBe(absY);
        expect(box.width).toBe(-50 + W + shiftX + PAD);
        expect(box.height).toBe(-30 + H + shiftY + PAD);
    });

    it('does not mutate the input nodes', () => {
        const nodes: Node[] = [
            { id: 'box', type: 'group', position: { x: 0, y: 0 }, data: {} },
            { id: 'child', type: 'custom', parentId: 'box', position: { x: -10, y: -10 }, data: {} },
        ];
        reflowContainersToFitChildren(nodes);
        expect(nodes[0].position).toEqual({ x: 0, y: 0 });
        expect(nodes[1].position).toEqual({ x: -10, y: -10 });
    });

    it('cascades an inner container shift outward so nesting stays enclosed', () => {
        const nodes: Node[] = [
            { id: 'outer', type: 'group', position: { x: 0, y: 0 }, data: {} },
            {
                id: 'inner',
                type: 'group',
                parentId: 'outer',
                position: { x: PAD, y: PAD },
                data: {},
                width: W + 2 * PAD,
                height: H + 2 * PAD,
                style: { width: W + 2 * PAD, height: H + 2 * PAD },
            },
            { id: 'leaf', type: 'custom', parentId: 'inner', position: { x: -40, y: -40 }, data: {} },
        ];
        const result = reflowContainersToFitChildren(nodes);
        const outer = result.find((n) => n.id === 'outer')!;
        const inner = result.find((n) => n.id === 'inner')!;
        // Inner shifted up/left to enclose the leaf; outer then grew/shifted to
        // keep the inner container fully enclosed.
        expect(inner.position.x).toBeGreaterThanOrEqual(0);
        expect(inner.position.y).toBeGreaterThanOrEqual(0);
        expect(inner.position.x + (inner.width as number)).toBeLessThanOrEqual(outer.width as number);
        expect(inner.position.y + (inner.height as number)).toBeLessThanOrEqual(outer.height as number);
    });
});

describe('createTopLevelLayout', () => {
    it('returns empty map for empty input', () => {
        const result = createTopLevelLayout([], []);
        expect(result.size).toBe(0);
    });

    it('returns positions for all nodes', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
        ];
        const result = createTopLevelLayout(nodes, []);

        expect(result.size).toBe(2);
        expect(result.has('node-1')).toBe(true);
        expect(result.has('node-2')).toBe(true);
    });

    it('returns positions with x and y coordinates', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        ];
        const result = createTopLevelLayout(nodes, []);

        const pos = result.get('node-1');
        expect(pos).toBeDefined();
        expect(typeof pos?.x).toBe('number');
        expect(typeof pos?.y).toBe('number');
    });

    it('respects custom node dimensions from style', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {}, style: { width: 400, height: 300 } },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
        ];
        const edges: Edge[] = [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ];
        const result = createTopLevelLayout(nodes, edges);

        // Both nodes should have positions
        expect(result.has('node-1')).toBe(true);
        expect(result.has('node-2')).toBe(true);

        // Large node should be positioned considering its size
        const pos1 = result.get('node-1')!;
        const pos2 = result.get('node-2')!;

        // With LR layout, node-1 should be to the left of node-2
        expect(pos1.x).toBeLessThan(pos2.x);
    });

    it('positions connected nodes in sequence', () => {
        const nodes: Node[] = [
            { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
            { id: 'node-2', position: { x: 0, y: 0 }, data: {} },
        ];
        const edges: Edge[] = [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
        ];
        const result = createTopLevelLayout(nodes, edges);

        const pos1 = result.get('node-1')!;
        const pos2 = result.get('node-2')!;

        // With LR layout, source should be to the left of target
        expect(pos1.x).toBeLessThan(pos2.x);
    });
});
