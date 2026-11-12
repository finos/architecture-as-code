import { describe, expect, it } from 'vitest';
import type { CalmFlow } from '../../../core/types';
import { removeDeletedRelationships } from './flow-model';

const flow: CalmFlow = {
    'unique-id': 'checkout',
    name: 'Checkout',
    description: '',
    transitions: [
        { 'relationship-unique-id': 'request', 'sequence-number': 1, description: 'Request' },
        { 'relationship-unique-id': 'response', 'sequence-number': 2, description: 'Response' },
    ],
};

describe('removeDeletedRelationships', () => {
    it('removes only transitions for deleted relationships', () => {
        expect(removeDeletedRelationships([flow], new Set(['request']))[0].transitions).toEqual([
            { 'relationship-unique-id': 'response', 'sequence-number': 2, description: 'Response' },
        ]);
    });

    it('keeps an empty flow editable after its last relationship is deleted', () => {
        expect(removeDeletedRelationships([flow], new Set(['request', 'response']))[0].transitions).toEqual([
            { 'relationship-unique-id': '', 'sequence-number': 1, description: '' },
        ]);
    });

    it('preserves flows unchanged when no relationship is deleted', () => {
        expect(removeDeletedRelationships([flow], new Set())[0]).toBe(flow);
    });
});