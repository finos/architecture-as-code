import { describe, it, expect } from 'vitest';
import { Node, Position } from 'reactflow';
import { getEdgeParams } from './floatingEdges';

// Helper to create a mock node with required properties
function createMockNode(
    id: string,
    x: number,
    y: number,
    width: number = 150,
    height: number = 50
): Node {
    return {
        id,
        position: { x, y },
        positionAbsolute: { x, y },
        width,
        height,
        data: {},
    };
}

describe('getEdgeParams', () => {
    it('calculates edge params for horizontally aligned nodes', () => {
        const source = createMockNode('source', 0, 0, 100, 50);
        const target = createMockNode('target', 200, 0, 100, 50);

        const result = getEdgeParams(source, target);

        // Source intersection should be on the right side of source node
        expect(result.sx).toBeGreaterThan(0);
        expect(result.sy).toBeCloseTo(25, 0); // Center of node height

        // Target intersection should be on the left side of target node
        expect(result.tx).toBeLessThan(250); // Less than target center x
        expect(result.ty).toBeCloseTo(25, 0); // Center of node height

        // Positions should be Right for source, Left for target
        expect(result.sourcePos).toBe(Position.Right);
        expect(result.targetPos).toBe(Position.Left);
    });

    it('calculates edge params for vertically aligned nodes', () => {
        const source = createMockNode('source', 0, 0, 100, 50);
        const target = createMockNode('target', 0, 200, 100, 50);

        const result = getEdgeParams(source, target);

        // Source intersection should be on the bottom of source node
        expect(result.sx).toBeCloseTo(50, 0); // Center of node width
        expect(result.sy).toBeGreaterThan(0);

        // Target intersection should be on the top of target node
        expect(result.tx).toBeCloseTo(50, 0); // Center of node width
        expect(result.ty).toBeLessThan(225); // Less than target center y

        // Positions should be Bottom for source, Top for target
        expect(result.sourcePos).toBe(Position.Bottom);
        expect(result.targetPos).toBe(Position.Top);
    });

    it('calculates edge params for diagonally positioned nodes', () => {
        const source = createMockNode('source', 0, 0, 100, 50);
        const target = createMockNode('target', 200, 200, 100, 50);

        const result = getEdgeParams(source, target);

        // Should return valid coordinates
        expect(typeof result.sx).toBe('number');
        expect(typeof result.sy).toBe('number');
        expect(typeof result.tx).toBe('number');
        expect(typeof result.ty).toBe('number');

        // Source point should be outside initial node position
        expect(result.sx).toBeGreaterThan(0);
        expect(result.sy).toBeGreaterThan(0);
    });

    it('handles nodes with different sizes', () => {
        const smallNode = createMockNode('small', 0, 0, 50, 30);
        const largeNode = createMockNode('large', 200, 0, 300, 150);

        const result = getEdgeParams(smallNode, largeNode);

        // Should calculate valid edge params
        expect(result.sx).toBeGreaterThan(0);
        expect(result.tx).toBeLessThan(350); // Less than large node right edge
        expect(result.sourcePos).toBe(Position.Right);
        expect(result.targetPos).toBe(Position.Left);
    });

    it('returns fallback values when node has no positionAbsolute', () => {
        const source: Node = {
            id: 'source',
            position: { x: 0, y: 0 },
            data: {},
        };
        const target: Node = {
            id: 'target',
            position: { x: 100, y: 0 },
            data: {},
        };

        const result = getEdgeParams(source, target);

        // Should return fallback values (0) when positionAbsolute is missing
        expect(result.sx).toBe(0);
        expect(result.sy).toBe(0);
        expect(result.tx).toBe(0);
        expect(result.ty).toBe(0);
    });

    it('returns fallback values when node has no dimensions', () => {
        const source: Node = {
            id: 'source',
            position: { x: 0, y: 0 },
            positionAbsolute: { x: 0, y: 0 },
            data: {},
        };
        const target: Node = {
            id: 'target',
            position: { x: 100, y: 0 },
            positionAbsolute: { x: 100, y: 0 },
            data: {},
        };

        const result = getEdgeParams(source, target);

        // Should return positionAbsolute values as fallback when dimensions missing
        expect(result.sx).toBe(0);
        expect(result.sy).toBe(0);
        expect(result.tx).toBe(100);
        expect(result.ty).toBe(0);
    });

    it('handles nodes at the same position', () => {
        const source = createMockNode('source', 100, 100, 100, 50);
        const target = createMockNode('target', 100, 100, 100, 50);

        const result = getEdgeParams(source, target);

        // Should handle overlapping nodes without errors
        expect(typeof result.sx).toBe('number');
        expect(typeof result.sy).toBe('number');
        expect(typeof result.tx).toBe('number');
        expect(typeof result.ty).toBe('number');
        expect(!isNaN(result.sx)).toBe(true);
        expect(!isNaN(result.sy)).toBe(true);
    });

    it('calculates correct positions for reverse direction (target to left of source)', () => {
        const source = createMockNode('source', 200, 0, 100, 50);
        const target = createMockNode('target', 0, 0, 100, 50);

        const result = getEdgeParams(source, target);

        // Source intersection should be on the left side
        expect(result.sourcePos).toBe(Position.Left);
        // Target intersection should be on the right side
        expect(result.targetPos).toBe(Position.Right);
    });

    it('calculates correct positions for target above source', () => {
        const source = createMockNode('source', 0, 200, 100, 50);
        const target = createMockNode('target', 0, 0, 100, 50);

        const result = getEdgeParams(source, target);

        // Source intersection should be on the top
        expect(result.sourcePos).toBe(Position.Top);
        // Target intersection should be on the bottom
        expect(result.targetPos).toBe(Position.Bottom);
    });
});
