import { describe, it, expect } from 'vitest';
import { coveredNodeTop } from './labelPlacement.js';

const node = (id: string, x: number, y: number, type = 'custom') => ({ id, type, width: 320, height: 100, positionAbsolute: { x, y } });

describe('coveredNodeTop', () => {
    const nodes = [node('group', 0, 0, 'group'), node('a', 0, 400), node('middle', 450, 400), node('b', 900, 400)];

    it('gives the top of a node the label would cover', () => {
        expect(coveredNodeTop(nodes, 600, 450, ['a', 'b'])).toBe(400);
    });

    it('ignores the edge\'s own ends and group containers', () => {
        expect(coveredNodeTop(nodes, 100, 450, ['a', 'b'])).toBeUndefined();
        expect(coveredNodeTop(nodes, 100, 50, ['a', 'b'])).toBeUndefined();
    });

    it('is undefined in the gap between nodes, and for a node not yet measured', () => {
        expect(coveredNodeTop(nodes, 400, 450, ['a', 'b'])).toBeUndefined();
        expect(coveredNodeTop([{ id: 'x', type: 'custom', positionAbsolute: { x: 0, y: 0 } }], 10, 10, [])).toBeUndefined();
    });
});
