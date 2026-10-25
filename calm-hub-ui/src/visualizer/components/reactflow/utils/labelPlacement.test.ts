import { describe, it, expect } from 'vitest';
import { calloutRects, calloutShift, coveredNodeTop } from './labelPlacement.js';

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

describe('calloutRects', () => {
    it('puts each reported callout below its node, from the node\'s bottom', () => {
        const nodes = [node('a', 0, 400), node('b', 900, 400), node('group', 0, 0, 'group')];
        const sizes = new Map([['a', { width: 320, height: 90 }], ['group', { width: 220, height: 60 }]]);
        expect(calloutRects(nodes, sizes)).toEqual([
            { x: 0, y: 500, width: 320, height: 90 },
            { x: 0, y: 100, width: 220, height: 60 },
        ]);
    });

    it('skips a node not yet measured', () => {
        expect(calloutRects([{ id: 'a', positionAbsolute: { x: 0, y: 0 } }], new Map([['a', { width: 10, height: 10 }]]))).toEqual([]);
    });
});

describe('calloutShift', () => {
    const callout = { x: 0, y: 500, width: 320, height: 90 };
    const label = (x: number, y: number) => ({ x, y, width: 100, height: 40 });

    it('moves a label that overlaps a callout to 8 below it', () => {
        expect(calloutShift(label(100, 560), [callout])).toBe(38);
    });

    it('clears the lowest of the callouts it overlaps', () => {
        expect(calloutShift(label(250, 560), [callout, { x: 300, y: 500, width: 320, height: 120 }])).toBe(68);
    });

    it('is 0 for a label clear of every callout, including one that only touches its edge', () => {
        expect(calloutShift(label(400, 560), [callout])).toBe(0);
        expect(calloutShift(label(100, 590), [callout])).toBe(0);
        expect(calloutShift(label(100, 560), [])).toBe(0);
    });
});
