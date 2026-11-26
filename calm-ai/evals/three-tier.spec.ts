import { expect, test } from 'vitest';
import { assertThreeTier } from './three-tier';

type Architecture = Parameters<typeof assertThreeTier>[0];

function architecture(): Architecture {
    return {
        $schema: 'https://calm.finos.org/release/1.3/meta/calm.json',
        nodes: [
            { 'unique-id': 'frontend', 'node-type': 'webclient' },
            { 'unique-id': 'database', 'node-type': 'database', interfaces: [{ 'unique-id': 'listener', port: 5432 }] },
            { 'unique-id': 'api', 'node-type': 'service' },
        ],
        relationships: [
            { protocol: 'JDBC', 'relationship-type': { connects: {
                source: { node: 'api' }, destination: { node: 'database', interfaces: ['listener'] },
            } } },
            { protocol: 'HTTPS', 'relationship-type': { connects: {
                source: { node: 'frontend' }, destination: { node: 'api' },
            } } },
        ],
    };
}

test('accepts the required topology in any order', () => {
    assertThreeTier(architecture());
});

const invalidCases: Record<string, (model: Architecture) => void> = {
    'extra node': model => { model.nodes.push({ 'unique-id': 'user', 'node-type': 'actor' }); },
    'extra link': model => { model.relationships.push(model.relationships[0]); },
    'missing link': model => { model.relationships.pop(); },
    'reversed link': model => {
        model.relationships[1]['relationship-type'].connects = {
            source: { node: 'api' }, destination: { node: 'frontend' },
        };
    },
    'wrong protocol': model => { model.relationships[1].protocol = 'HTTP'; },
    'wrong interface reference': model => {
        model.nodes[1].interfaces?.push({ 'unique-id': 'other-listener', port: 5433 });
        model.relationships[0]['relationship-type'].connects!.destination.interfaces = ['other-listener'];
    },
    'wrong port': model => { model.nodes[1].interfaces![0].port = 5433; },
};

test.each(Object.entries(invalidCases))('rejects %s', (_name, change) => {
    const model = architecture();
    change(model);
    expect(() => assertThreeTier(model)).toThrow();
});
