import { describe, it, expect } from 'vitest';
import { joinEdgeMetadata, splitEdgeMetadata } from './edge-metadata';

describe('splitEdgeMetadata', () => {
    it('gives the defaults when there is no metadata', () => {
        expect(splitEdgeMetadata(undefined)).toEqual({ lineStyle: 'solid', routing: 'bezier', edgeMetadata: {} });
    });

    it('holds line-style and routing apart from the other fields', () => {
        expect(splitEdgeMetadata({ 'line-style': 'dashed', owner: 'team', routing: 'step' }))
            .toEqual({ lineStyle: 'dashed', routing: 'step', edgeMetadata: { owner: 'team' } });
    });
});

describe('joinEdgeMetadata', () => {
    it.each([
        ['no metadata', undefined],
        ['empty metadata', {}],
        ['explicit defaults', { 'line-style': 'solid', routing: 'bezier' }],
        ['other fields', { owner: 'team', 'line-style': 'dashed' }],
    ])('returns the original when the canvas did not change %s', (_name, original) => {
        expect(joinEdgeMetadata(splitEdgeMetadata(original), original)).toBe(original);
    });

    it('puts line-style back in its original position', () => {
        const original = { 'line-style': 'dashed', owner: 'team' };
        expect(Object.keys(joinEdgeMetadata({ ...splitEdgeMetadata(original), lineStyle: 'dotted' }, original)!))
            .toEqual(['line-style', 'owner']);
    });

    it('leaves out default line-style and routing after an edit', () => {
        expect(joinEdgeMetadata({ lineStyle: 'solid', routing: 'bezier', edgeMetadata: { owner: 'x' } }, { owner: 'team' }))
            .toEqual({ owner: 'x' });
    });

    it('removes metadata that the canvas emptied', () => {
        expect(joinEdgeMetadata({ edgeMetadata: {} }, { owner: 'team' })).toBeUndefined();
    });
});
