import { describe, expect, it } from 'vitest';
import type { Shape } from '../../model/lens.js';
import { fitShape, mapPath, placePart, placeSlot, wrap } from './geometry.js';

const box = (fields: Partial<Shape> = {}): Shape => ({
    viewBox: [0, 0, 100, 50],
    parts: [{ rect: { x: 0, y: 0, width: 100, height: 50 } }],
    ...fields,
});

describe('fitShape', () => {
    it('keeps the corners of a nine-slice shape and stretches the middle', () => {
        const fit = fitShape(box({ resize: { mode: 'nine-slice', insets: [10, 10, 10, 10] } }), undefined, undefined, 200, 50);
        expect(fit.x(5)).toBe(5);
        expect(fit.x(95)).toBe(195);
        expect(fit.x(50)).toBe(100);
    });

    it('grows a shape inside the band of its grow slot, so the parts above it keep their place', () => {
        const shape: Shape = {
            viewBox: [0, 0, 200, 100],
            parts: [{ rect: { x: 0, y: 0, width: 200, height: 100 } }],
            slots: { description: { x: 0, y: 40, width: 200, height: 20, grow: true } },
        };
        // 27 characters fit on a line of 200 pixels at the normal size, so nine words take three lines.
        const fit = fitShape(shape, { id: 'n', label: 'N', description: Array(9).fill('abcdefgh').join(' ') });
        const extra = 3 * 13 * 1.3 - 20;
        expect(fit.height).toBeCloseTo(100 + extra);
        expect(fit.y(30)).toBeCloseTo(30);
        expect(fit.y(60)).toBeCloseTo(60 + extra);
    });

    it('does not grow for a description that the style hides', () => {
        const shape: Shape = { ...box(), slots: { description: { x: 0, y: 20, width: 100, height: 10, grow: true } } };
        const node = { id: 'n', label: 'N', description: 'a long description that takes more than one line' };
        expect(fitShape(shape, node, { metadata: true, description: false }).height).toBe(50);
    });

    it('keeps the ratio of an aspect shape and centres it', () => {
        const fit = fitShape(box({ viewBox: [0, 0, 100, 100], resize: { mode: 'aspect' } }), undefined, undefined, 200, 100);
        expect([fit.x(0), fit.y(0), fit.x(100)]).toEqual([50, 0, 150]);
    });
});

describe('placePart', () => {
    it('keeps a pinned part at its size, at its corner', () => {
        const shape = box();
        const fit = fitShape(shape, undefined, undefined, 200, 50);
        const placed = placePart({ rect: { x: 80, y: 5, width: 10, height: 10 }, pin: 'top-right' }, fit, shape.viewBox);
        expect(placed).toMatchObject({ kind: 'rect', x: 180, y: 5, width: 10, height: 10 });
    });
});

describe('mapPath', () => {
    it('makes each command absolute before it maps the points', () => {
        const fit = fitShape(box(), undefined, undefined, 200, 50);
        expect(mapPath('m10 10 h20 v5 z', fit.x, fit.y, fit.sx, fit.sy)).toBe('M20 10 L60 10 L60 15 Z');
    });
});

describe('text', () => {
    it('wraps at words and breaks a word that is longer than the line', () => {
        expect(wrap('ab cd abcdefghij', 5.5 * 13 * 0.55, 13)).toEqual(['ab cd', 'abcde', 'fghij']);
    });

    it('cuts text that does not fit the slot, with an ellipsis', () => {
        const fit = fitShape(box(), undefined, undefined, 100, 50);
        const text = placeSlot({ x: 0, y: 0, width: 100, height: 18 }, fit, Array(10).fill('word').join(' '));
        expect(text?.lines).toHaveLength(1);
        expect(text?.lines[0].text.endsWith('…')).toBe(true);
    });
});
