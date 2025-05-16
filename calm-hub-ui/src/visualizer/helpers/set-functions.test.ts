import { describe, expect, it } from 'vitest';
import { difference, intersection, union } from './set-functions.js';

describe('union', () => {
    it('should return the union of two sets', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([3, 4, 5]);
        const result = union(set1, set2);
        expect(result).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it('should return the first set if the second set is empty', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set();
        const result = union(set1, set2);
        expect(result).toEqual(new Set([1, 2, 3]));
    });

    it('should return the second set if the first set is empty', () => {
        const set1 = new Set();
        const set2 = new Set([3, 4, 5]);
        const result = union(set1, set2);
        expect(result).toEqual(new Set([3, 4, 5]));
    });
});

describe('intersection', () => {
    it('should return the intersection of two sets', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([2, 3, 4]);
        const result = intersection(set1, set2);
        expect(result).toEqual(new Set([2, 3]));
    });

    it('should return an empty set if there is no intersection', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([4, 5, 6]);
        const result = intersection(set1, set2);
        expect(result).toEqual(new Set());
    });

    it('should return an empty set if one of the sets is empty', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set();
        const result = intersection(set1, set2);
        expect(result).toEqual(new Set());
    });
});

describe('difference', () => {
    it('should return the difference of two sets', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([2, 3, 4]);
        const result = difference(set1, set2);
        expect(result).toEqual(new Set([1]));
    });

    it('should return the first set if the second set is empty', () => {
        const set1 = new Set([1, 2, 3]);
        const set2 = new Set();
        const result = difference(set1, set2);
        expect(result).toEqual(new Set([1, 2, 3]));
    });

    it('should return an empty set if the first set is empty', () => {
        const set1 = new Set();
        const set2 = new Set([2, 3, 4]);
        const result = difference(set1, set2);
        expect(result).toEqual(new Set());
    });
});
