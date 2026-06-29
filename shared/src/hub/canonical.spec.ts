import { describe, it, expect } from 'vitest';
import { canonicalEqual, canonicalize } from './canonical';

describe('canonical', () => {
    describe('canonicalEqual', () => {
        it('treats key-reordered objects as equal', () => {
            expect(canonicalEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        });

        it('treats nested key-reordered objects as equal', () => {
            expect(canonicalEqual(
                { outer: { a: 1, b: { c: 3, d: 4 } } },
                { outer: { b: { d: 4, c: 3 }, a: 1 } }
            )).toBe(true);
        });

        it('detects value differences', () => {
            expect(canonicalEqual({ a: 1 }, { a: 2 })).toBe(false);
        });

        it('is sensitive to array order', () => {
            expect(canonicalEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
        });

        it('compares primitives directly', () => {
            expect(canonicalEqual('x', 'x')).toBe(true);
            expect(canonicalEqual('x', 'y')).toBe(false);
        });
    });

    describe('canonicalize', () => {
        it('sorts object keys recursively while preserving array order', () => {
            expect(JSON.stringify(canonicalize({ b: 2, a: [{ y: 1, x: 2 }] })))
                .toBe(JSON.stringify({ a: [{ x: 2, y: 1 }], b: 2 }));
        });
    });
});
