import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArrowMarker, arrowMarkerId, hasMarker } from './ArrowMarker';

describe('arrowMarkerId', () => {
    it('keeps a plain edge id readable', () => {
        expect(arrowMarkerId('api-to-db', 'end')).toBe('calm-arrow-end-api-to-db');
        expect(arrowMarkerId('api-to-db', 'start')).toBe('calm-arrow-start-api-to-db');
    });

    it('escapes characters that would break url(#…)', () => {
        const id = arrowMarkerId('a b#c(d)', 'end');
        expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('gives different ids for edge ids that differ only in escaped characters', () => {
        const ids = ['a b', 'a_b', 'a.b', 'a_20_b'].map(e => arrowMarkerId(e, 'end'));
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('hasMarker', () => {
    it('is true for an end with a marker', () => {
        expect(hasMarker("url('#1__type=arrowclosed')")).toBe(true);
    });

    it("is false for an end with no marker, which React Flow passes as url('#')", () => {
        expect(hasMarker("url('#')")).toBe(false);
        expect(hasMarker(undefined)).toBe(false);
        expect(hasMarker('')).toBe(false);
    });
});

describe('ArrowMarker', () => {
    it('fills and strokes the arrowhead with the given colour', () => {
        const html = renderToStaticMarkup(
            <svg><ArrowMarker id="m" color="var(--vscode-textLink-foreground, #3794ff)" /></svg>
        );
        expect(html).toContain('id="m"');
        expect(html).toContain('stroke:var(--vscode-textLink-foreground, #3794ff)');
        expect(html).toContain('fill:var(--vscode-textLink-foreground, #3794ff)');
    });
});
