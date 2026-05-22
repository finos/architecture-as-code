import { describe, it, expect } from 'vitest';
import { diffPatterns, normalisePatternToInstance } from './pattern-diff.js';
import testPatterns from './fixtures/diff-test-patterns.json' with { type: 'json' };

describe('normalisePatternToInstance', () => {
    it('reduces a pattern schema to instance-shaped nodes and relationships', () => {
        const { nodes, relationships } = normalisePatternToInstance(testPatterns.basePattern);
        expect(nodes).toHaveLength(3);
        expect(relationships).toHaveLength(2);

        const gateway = nodes.find((n) => n['unique-id'] === 'api-gateway');
        expect(gateway).toEqual({
            'unique-id': 'api-gateway',
            name: 'API Gateway',
            'node-type': 'service',
        });
    });

    it('collapses const-wrapped relationship-type objects', () => {
        const { relationships } = normalisePatternToInstance(testPatterns.basePattern);
        const rel = relationships.find((r) => r['unique-id'] === 'gateway-to-payment');
        expect(rel?.['relationship-type']).toEqual({
            connects: { source: { node: 'api-gateway' }, destination: { node: 'payment-service' } },
        });
    });

    it('reads nodes nested under allOf', () => {
        const { nodes } = normalisePatternToInstance(testPatterns.allOfPattern);
        expect(nodes.map((n) => n['unique-id'])).toEqual(['api-gateway']);
    });

    it('expands oneOf decision groups into individual nodes', () => {
        const { nodes } = normalisePatternToInstance(testPatterns.decisionPattern);
        expect(nodes.map((n) => n['unique-id'])).toEqual([
            'api-gateway',
            'postgres-store',
            'dynamo-store',
        ]);
    });

    it('returns empty arrays for a non-object input', () => {
        expect(normalisePatternToInstance(null)).toEqual({ nodes: [], relationships: [] });
        expect(normalisePatternToInstance('not a pattern')).toEqual({ nodes: [], relationships: [] });
    });
});

describe('diffPatterns', () => {
    it('detects added nodes and relationships', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.additionPattern);
        expect(result.nodesAdded).toHaveLength(1);
        expect(result.nodesAdded[0]['unique-id']).toBe('audit-service');
        expect(result.edgesAdded).toHaveLength(1);
        expect(result.edgesAdded[0]['unique-id']).toBe('payment-to-audit');
    });

    it('detects removed nodes and relationships', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.removalPattern);
        expect(result.nodesRemoved).toHaveLength(1);
        expect(result.nodesRemoved[0]['unique-id']).toBe('user-db');
        expect(result.edgesRemoved).toHaveLength(1);
        expect(result.edgesRemoved[0]['unique-id']).toBe('payment-to-db');
    });

    it('detects modified nodes', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.modificationPattern);
        expect(result.nodesModified).toHaveLength(1);
        expect(result.nodesModified[0].original['unique-id']).toBe('api-gateway');
        expect(result.nodesModified[0].updated.name).toBe('API Gateway v2');
    });

    it('detects renamed nodes and excludes them from added/removed', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.renamePattern);
        expect(result.nodesRenamed).toHaveLength(1);
        expect(result.nodesRenamed[0].oldId).toBe('payment-service');
        expect(result.nodesRenamed[0].newId).toBe('payment-processor');
        expect(result.nodesAdded).toHaveLength(0);
        expect(result.nodesRemoved).toHaveLength(0);
    });

    it('reports no changes for identical patterns', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.basePattern);
        expect(result.nodesModified).toHaveLength(0);
        expect(result.nodesRenamed).toHaveLength(0);
        expect(result.edgesModified).toHaveLength(0);
        expect(result.nodesSame).toHaveLength(3);
        expect(result.edgesSame).toHaveLength(2);
    });

    it('diffs nodes inside decision groups individually', () => {
        const result = diffPatterns(testPatterns.basePattern, testPatterns.decisionPattern);
        const addedIds = result.nodesAdded.map((n) => n['unique-id']);
        expect(addedIds).toContain('postgres-store');
        expect(addedIds).toContain('dynamo-store');
    });
});
