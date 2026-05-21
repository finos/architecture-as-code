import { describe, expect, it } from 'vitest';
import { DiffResult } from '@finos/calm-models/diff';
import { parsePatternDataWithDiff } from './patternDiffTransformer.js';

const pattern = {
    properties: {
        nodes: {
            type: 'array',
            prefixItems: [
                {
                    properties: {
                        'unique-id': { const: 'api-gateway' },
                        name: { const: 'API Gateway' },
                        'node-type': { const: 'service' },
                    },
                },
                {
                    properties: {
                        'unique-id': { const: 'payment-service' },
                        name: { const: 'Payment Service' },
                        'node-type': { const: 'service' },
                    },
                },
            ],
        },
        relationships: { type: 'array', prefixItems: [] },
    },
};

const emptyDiff: DiffResult = {
    nodesAdded: [],
    nodesRemoved: [],
    nodesModified: [],
    nodesRenamed: [],
    nodesSame: [],
    edgesAdded: [],
    edgesRemoved: [],
    edgesModified: [],
    edgesRenamed: [],
    edgesSame: [],
};

describe('patternDiffTransformer', () => {
    it('returns the base pattern graph when diffResult is null', () => {
        const result = parsePatternDataWithDiff(pattern, null, true);
        expect(result.nodes).toHaveLength(2);
        expect(result.nodes[0].data.diffStatus).toBeUndefined();
    });

    it('annotates an added pattern node by unique-id', () => {
        const diffResult: DiffResult = {
            ...emptyDiff,
            nodesAdded: [{ 'unique-id': 'payment-service', name: 'Payment Service', 'node-type': 'service' }],
        };
        const result = parsePatternDataWithDiff(pattern, diffResult, false);
        const added = result.nodes.find((n) => n.id === 'payment-service');
        expect(added?.data.diffStatus).toBe('added');
        expect(added?.style).toMatchObject({ boxShadow: '0 0 0 3px #16a34a' });
        expect(result.nodes.find((n) => n.id === 'api-gateway')?.data.diffStatus).toBe('unchanged');
    });
});
