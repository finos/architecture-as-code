import { describe, it, expect } from 'vitest';
import { instantiateFromPattern } from './PatternPicker.js';

function node(uniqueId: string, name: string) {
    return {
        properties: {
            'unique-id': { const: uniqueId },
            name: { const: name },
            'node-type': { const: 'service' },
        },
    };
}

describe('instantiateFromPattern', () => {
    it('instantiates prefixItems nodes and relationships', () => {
        const pattern = {
            properties: {
                nodes: { prefixItems: [node('api-gateway', 'API Gateway')] },
                relationships: { prefixItems: [] },
            },
        };
        const result = instantiateFromPattern(pattern);
        expect(result.nodes).toHaveLength(1);
        expect(result.nodes[0]['unique-id']).toBe('api-gateway');
    });

    it('instantiates a candidate from an items catalog alongside prefixItems', () => {
        const pattern = {
            properties: {
                nodes: {
                    prefixItems: [node('webapp', 'Web App')],
                    items: { anyOf: [node('redis', 'Redis')] },
                },
                relationships: { prefixItems: [] },
            },
        };
        const result = instantiateFromPattern(pattern);
        const ids = result.nodes.map((n: Record<string, unknown>) => n['unique-id']);
        expect(ids).toContain('webapp');
        expect(ids).toContain('redis');
    });

    it('previews a catalog-only pattern rather than leaving it empty', () => {
        const pattern = {
            properties: {
                nodes: { items: { oneOf: [node('cache', 'Cache')] } },
                relationships: { prefixItems: [] },
            },
        };
        const result = instantiateFromPattern(pattern);
        expect(result.nodes.map((n: Record<string, unknown>) => n['unique-id'])).toEqual(['cache']);
    });
});
