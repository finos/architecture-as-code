import { describe, it, expect } from 'vitest';
import type { CalmFlowTransitionSchema } from '@finos/calm-models/types';
import {
    IDLE_STEP,
    STATUS_COMPLETE,
    STATUS_IDLE,
    activeSequenceNumber,
    describeStep,
    visitedSequenceNumbers,
} from './flow-step.js';

describe('activeSequenceNumber', () => {
    const seqNumbers = [1, 2, 5];

    it('returns null while idle', () => {
        expect(activeSequenceNumber(IDLE_STEP, seqNumbers)).toBeNull();
    });

    it('maps a step index onto its sequence number', () => {
        expect(activeSequenceNumber(0, seqNumbers)).toBe(1);
        expect(activeSequenceNumber(2, seqNumbers)).toBe(5);
    });

    it('returns null past the last step (completed sentinel)', () => {
        expect(activeSequenceNumber(3, seqNumbers)).toBeNull();
    });
});

describe('visitedSequenceNumbers', () => {
    const seqNumbers = [1, 2, 5];

    it('is empty while idle', () => {
        expect(visitedSequenceNumbers(IDLE_STEP, seqNumbers).size).toBe(0);
    });

    it('includes every sequence number up to the current step', () => {
        expect([...visitedSequenceNumbers(1, seqNumbers)]).toEqual([1, 2]);
    });

    it('includes all steps once completed', () => {
        expect([...visitedSequenceNumbers(3, seqNumbers)]).toEqual([1, 2, 5]);
    });
});

describe('describeStep', () => {
    const transitions: CalmFlowTransitionSchema[] = [
        { 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'First' },
        { 'relationship-unique-id': 'b-to-c', 'sequence-number': 2, description: 'Parallel A' },
        { 'relationship-unique-id': 'b-to-d', 'sequence-number': 2, description: 'Parallel B' },
    ];

    it('reports the idle status when nothing is active', () => {
        expect(describeStep(null, transitions, false)).toBe(STATUS_IDLE);
    });

    it('reports completion once past the last step', () => {
        expect(describeStep(null, transitions, true)).toBe(STATUS_COMPLETE);
    });

    it('joins parallel transitions into one line', () => {
        expect(describeStep(2, transitions, false)).toBe('Parallel A · Parallel B');
    });
});
