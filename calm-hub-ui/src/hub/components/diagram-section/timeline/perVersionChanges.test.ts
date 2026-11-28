import { describe, expect, it } from 'vitest';
import { computeChanges } from './perVersionChanges.js';

const cache = { properties: { 'unique-id': { const: 'cache' }, 'node-type': { const: 'database' } } };
const pattern = (nodes: { prefixItems: unknown[]; items?: unknown }) => ({
    properties: {
        nodes: { type: 'array', minItems: nodes.prefixItems.length, ...nodes },
        relationships: { type: 'array', prefixItems: [] },
    },
});

describe('computeChanges', () => {
    it('lists a pattern node whose obligation changed', () => {
        const changes = computeChanges(
            'Patterns',
            pattern({ prefixItems: [], items: { anyOf: [cache] } }),
            pattern({ prefixItems: [cache] })
        );
        expect(changes).toEqual([
            { kind: 'mod', text: 'Modified node cache (catalogue → required)' },
            { kind: 'mod', text: 'Changed nodes minItems 0 → 1' },
        ]);
    });

    it('shows the obligation change of a modified node on its one row', () => {
        const database = { properties: { 'unique-id': { const: 'cache' }, 'node-type': { const: 'service' } } };
        const changes = computeChanges('Patterns', pattern({ prefixItems: [cache] }), pattern({ prefixItems: [], items: { anyOf: [database] } }));
        expect(changes).toEqual([
            { kind: 'mod', text: 'Modified node cache (required → catalogue)' },
            { kind: 'mod', text: 'Changed nodes minItems 1 → 0' },
        ]);
    });

    it('shows the obligation change of a renamed node on its one row', () => {
        const renamed = { properties: { 'unique-id': { const: 'cache-v2' }, 'node-type': { const: 'database' } } };
        const changes = computeChanges('Patterns', pattern({ prefixItems: [cache] }), pattern({ prefixItems: [], items: { anyOf: [renamed] } }));
        expect(changes).toEqual([
            { kind: 'mod', text: 'Renamed node cache → cache-v2 (required → catalogue)' },
            { kind: 'mod', text: 'Changed nodes minItems 1 → 0' },
        ]);
    });

    it('returns no changes when a version is missing', () => {
        expect(computeChanges('Patterns', null, pattern({ prefixItems: [cache] }))).toEqual([]);
    });
});
