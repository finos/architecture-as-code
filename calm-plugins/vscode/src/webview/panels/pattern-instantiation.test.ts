import { describe, it, expect } from 'vitest';
import { instantiateFromPattern } from './pattern-instantiation';

const node = (id: string) => ({
    type: 'object',
    properties: { 'unique-id': { const: id }, 'node-type': { const: 'service' }, name: { const: id } },
});

const relationship = (id: string) => ({
    type: 'object',
    properties: { 'unique-id': { const: id } },
});

const ids = (elements: any[]) => elements.map((element) => element['unique-id']);

describe('instantiateFromPattern', () => {
    it('instantiates a node declared in a prefixItems entry', () => {
        const arch = instantiateFromPattern({ properties: { nodes: { prefixItems: [node('gateway')] } } });

        expect(arch.nodes).toEqual([{ 'unique-id': 'gateway', 'node-type': 'service', name: 'gateway' }]);
    });

    it('takes the first alternative of a prefixItems entry', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [{ oneOf: [node('postgres'), node('mysql')] }] } },
        });

        expect(ids(arch.nodes)).toEqual(['postgres']);
    });

    it('instantiates a node from an items catalogue, after the positional entries', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [node('gateway')], items: { oneOf: [node('cache'), node('queue')] } } },
        });

        expect(ids(arch.nodes)).toEqual(['gateway', 'cache']);
    });

    it('instantiates a node from an anyOf catalogue', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { items: { anyOf: [node('cache')] } } },
        });

        expect(ids(arch.nodes)).toEqual(['cache']);
    });

    it('instantiates a relationship from an items catalogue', () => {
        const arch = instantiateFromPattern({
            properties: { relationships: { items: { oneOf: [relationship('gateway-connects-cache')] } } },
        });

        expect(ids(arch.relationships)).toEqual(['gateway-connects-cache']);
    });

    it('ignores an items schema that declares a node directly', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [node('gateway')], items: node('cache') } },
        });

        expect(ids(arch.nodes)).toEqual(['gateway']);
    });

    it('ignores an items schema that only references another schema', () => {
        const arch = instantiateFromPattern({
            properties: { nodes: { prefixItems: [node('gateway')], items: { $ref: 'core.json#/defs/node' } } },
        });

        expect(ids(arch.nodes)).toEqual(['gateway']);
    });

    it('returns empty arrays for a pattern that declares nothing', () => {
        expect(instantiateFromPattern({})).toEqual({ nodes: [], relationships: [] });
    });
});
