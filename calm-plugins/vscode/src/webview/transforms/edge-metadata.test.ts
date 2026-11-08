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

    it('reads line-style and routing from their own element of array metadata', () => {
        expect(splitEdgeMetadata([{ owner: 'team' }, { 'line-style': 'dashed' }, { tier: 1 }]))
            .toEqual({ lineStyle: 'dashed', routing: 'bezier', edgeMetadata: { 0: { owner: 'team' }, 1: { tier: 1 } } });
    });
});

describe('joinEdgeMetadata', () => {
    it.each([
        ['no metadata', undefined],
        ['empty metadata', {}],
        ['explicit defaults', { 'line-style': 'solid', routing: 'bezier' }],
        ['other fields', { owner: 'team', 'line-style': 'dashed' }],
        ['array metadata', [{ owner: 'team' }, { 'line-style': 'dashed' }]],
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

    it('keeps array metadata an array when the line style changes', () => {
        const original = [{ owner: 'team' }];
        expect(joinEdgeMetadata({ ...splitEdgeMetadata(original), lineStyle: 'dotted' }, original))
            .toEqual([{ owner: 'team' }, { 'line-style': 'dotted' }]);
    });

    it('removes the style element of array metadata when the style returns to the defaults', () => {
        const original = [{ owner: 'team' }, { 'line-style': 'dotted' }];
        expect(joinEdgeMetadata({ ...splitEdgeMetadata(original), lineStyle: 'solid' }, original))
            .toEqual([{ owner: 'team' }]);
    });

    it('adds a named field to array metadata in an element of its own', () => {
        const original = [{ owner: 'team' }];
        const fields = splitEdgeMetadata(original);
        expect(joinEdgeMetadata({ ...fields, edgeMetadata: { ...fields.edgeMetadata, tier: 'gold' } }, original))
            .toEqual([{ owner: 'team' }, { tier: 'gold' }]);
    });

    it('reads every style element of array metadata and writes them back as one', () => {
        const original = [{ routing: 'step' }, { 'line-style': 'dashed' }, { owner: 'team' }];
        const fields = splitEdgeMetadata(original);
        expect(fields).toMatchObject({ lineStyle: 'dashed', routing: 'step' });
        expect(joinEdgeMetadata({ ...fields, lineStyle: 'dotted' }, original))
            .toEqual([{ owner: 'team' }, { 'line-style': 'dotted', routing: 'step' }]);
    });

    it('removes array metadata that the canvas emptied', () => {
        expect(joinEdgeMetadata({ edgeMetadata: {} }, [{ owner: 'team' }])).toBeUndefined();
    });
});
