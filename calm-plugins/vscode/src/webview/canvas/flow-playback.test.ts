import { describe, expect, it } from 'vitest';
import type { CalmTransition } from '../../core/types';
import { getFlowEdgeDirections, getFlowPlaybackState } from './flow-playback';

const transitions: CalmTransition[] = [
    { 'relationship-unique-id': 'request', 'sequence-number': 6, description: '' },
    { 'relationship-unique-id': 'request', 'sequence-number': 2, description: '' },
    { 'relationship-unique-id': 'query', 'sequence-number': 2, description: '' },
    { 'relationship-unique-id': 'response', 'sequence-number': 4, description: '' },
];

describe('getFlowPlaybackState', () => {
    it('sorts non-contiguous sequence numbers and groups parallel transitions', () => {
        expect(getFlowPlaybackState(transitions, 2)).toEqual({
            sequenceNumbers: [2, 4, 6], activeSequence: 4, visitedSequences: new Set([2]),
        });
    });

    it('has no active or visited transitions while idle', () => {
        expect(getFlowPlaybackState(transitions, 0)).toEqual({
            sequenceNumbers: [2, 4, 6], activeSequence: null, visitedSequences: new Set(),
        });
    });

    it('handles an empty flow and out-of-range steps without an active transition', () => {
        expect(getFlowPlaybackState([], 1).activeSequence).toBeNull();
        expect(getFlowPlaybackState(transitions, 4).activeSequence).toBeNull();
    });
});

describe('getFlowEdgeDirections', () => {
    it('matches only the current transitions for an edge', () => {
        expect(getFlowEdgeDirections(transitions, 2, 'request', 'response')).toEqual(['forward']);
        expect(getFlowEdgeDirections(transitions, 4, 'request', 'response')).toEqual(['reverse']);
        expect(getFlowEdgeDirections(transitions, 2, 'unrelated')).toEqual([]);
        expect(getFlowEdgeDirections(transitions, null, 'request')).toEqual([]);
    });

    it.each([
        ['request', 'source-to-destination', 'forward'],
        ['request', 'destination-to-source', 'reverse'],
        ['response', 'source-to-destination', 'reverse'],
        ['response', 'destination-to-source', 'forward'],
    ] as const)('orients %s with %s as %s', (id, direction, expected) => {
        const transition: CalmTransition = {
            'relationship-unique-id': id, 'sequence-number': 1, description: '', direction,
        };
        expect(getFlowEdgeDirections([transition], 1, 'request', 'response')).toEqual([expected]);
    });

    it('keeps both directions for simultaneous opposing transitions without duplicates', () => {
        const parallel = transitions.map(t => ({ ...t, 'sequence-number': 1 }));
        expect(getFlowEdgeDirections(parallel, 1, 'request', 'response')).toEqual(['forward', 'reverse']);
    });
});
