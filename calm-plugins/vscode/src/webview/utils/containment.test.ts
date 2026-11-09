import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import { containerAt } from './containment';

const container = (id: string, x: number, y: number, extra: Partial<Node> = {}): Node =>
    ({ id, type: 'container', position: { x, y }, width: 100, height: 100, data: {}, ...extra });

describe('containerAt', () => {
    it('gives the container drawn on top: the deepest, then the last', () => {
        const nodes = [
            container('C', 0, 0, { width: 300, height: 300 }),
            container('N', 50, 50, { parentId: 'C', zIndex: 1 }),
            // Added later from the palette, at the top level, over N
            container('P', 60, 60),
        ];

        expect(containerAt({ x: 70, y: 70 }, nodes)?.id).toBe('N');
        expect(containerAt({ x: 155, y: 155 }, nodes)?.id).toBe('P');
        expect(containerAt({ x: 10, y: 10 }, nodes)?.id).toBe('C');
        expect(containerAt({ x: 500, y: 500 }, nodes)).toBeUndefined();
    });

    it('ignores nodes that are not containers', () => {
        expect(containerAt({ x: 10, y: 10 }, [{ ...container('n', 0, 0), type: 'service' }])).toBeUndefined();
    });
});
