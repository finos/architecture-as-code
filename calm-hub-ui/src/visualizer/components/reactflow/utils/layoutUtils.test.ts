import { describe, it, expect } from 'vitest';
import { Node, Edge } from 'reactflow';
import { getLayoutedElements, createTopLevelLayout } from './layoutUtils';

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
