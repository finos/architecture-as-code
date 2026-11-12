import { describe, expect, it } from 'vitest';
import { nodeGeometry, nodeHeight, nodePositionAbsolute, nodeWidth } from './nodeGeometry.js';

describe('nodeGeometry', () => {
    it('reads measured size and internals.positionAbsolute from a React Flow 12 InternalNode', () => {
        const node = {
            id: 'a',
            type: 'custom',
            measured: { width: 120, height: 40 },
            internals: { positionAbsolute: { x: 8, y: 16 } },
        };

        expect(nodeWidth(node)).toBe(120);
        expect(nodeHeight(node)).toBe(40);
        expect(nodePositionAbsolute(node)).toEqual({ x: 8, y: 16 });
        expect(nodeGeometry(node)).toEqual({
            id: 'a',
            type: 'custom',
            width: 120,
            height: 40,
            positionAbsolute: { x: 8, y: 16 },
        });
    });

    it('falls back to width, height and positionAbsolute from a React Flow 11-shaped node', () => {
        const node = {
            id: 'b',
            width: 100,
            height: 50,
            positionAbsolute: { x: 1, y: 2 },
        };

        expect(nodeGeometry(node)).toEqual({
            id: 'b',
            type: undefined,
            width: 100,
            height: 50,
            positionAbsolute: { x: 1, y: 2 },
        });
    });
});
