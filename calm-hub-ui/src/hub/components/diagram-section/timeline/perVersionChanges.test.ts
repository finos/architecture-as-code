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
        expect(changes).toEqual([{ kind: 'mod', text: 'Node cache changed from catalogue to required' }]);
    });

    it('returns no changes when a version is missing', () => {
        expect(computeChanges('Patterns', null, pattern({ prefixItems: [cache] }))).toEqual([]);
    });
});
