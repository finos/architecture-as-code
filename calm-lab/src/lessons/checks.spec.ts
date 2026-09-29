import { describe, it, expect } from 'vitest';
import {
    completeNodes, composedOf, connectsBetween, connectsNodes, connectsRelationshipsBetween, connectsUsesInterfaces,
    controlsIn, everyHas, fileJson, fileText, filledAdr, flowsWithTransitions, freshOutcomes, hasDescription,
    hasMetadata, hasPlaceholder, interactsWith, linkedAdrs, markdownSection, nodeById, nodeInterfaces, nodes,
    nodesOfType, patternArrayRefs, patternConnects, patternItemConsts, patternNodeIds, patternNodeTypes, patternRefs, patternRequires,
    ranFailed, ranOk, rejected, relationships, relationshipsOfKind, standardExample, standardRequires, urlMappingEntries,
    urlMappingTargets, withStandard, validatedEditorFile,
} from './checks';
import type { CommandOutcome } from '../cli/outcome';
import type { LessonState } from './types';

const doc = {
    nodes: [
        { 'unique-id': 'web', 'node-type': 'webclient' },
        { 'unique-id': 'svc', 'node-type': 'service' },
        { 'unique-id': 'db', 'node-type': 'database' },
        { 'unique-id': 'user', 'node-type': 'actor' },
        { 'unique-id': 'sys', 'node-type': 'system' },
    ],
    relationships: [
        { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } } },
        { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } },
        { 'unique-id': 'r3', 'relationship-type': { 'composed-of': { container: 'sys', nodes: ['svc', 'db'] } } },
    ],
};

describe('document helpers', () => {
    it('never throw on partial or wrong-shaped documents', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { nodes: [null, 3] }, { relationships: [{ 'relationship-type': null }] }]) {
            expect(nodes(bad as never)).toBeInstanceOf(Array);
            expect(relationships(bad as never)).toBeInstanceOf(Array);
            expect(connectsBetween(bad as never, 'service', 'database')).toBe(false);
            expect(connectsNodes(bad as never, 'svc', 'db')).toBe(false);
            expect(interactsWith(bad as never, 'actor', 'service')).toBe(false);
            expect(composedOf(bad as never, 'system', ['service'])).toBe(false);
        }
    });

    it('find nodes by id and type', () => {
        expect(nodeById(doc, 'db')?.['node-type']).toBe('database');
        expect(nodesOfType(doc, 'service').map((node) => node['unique-id'])).toEqual(['svc']);
    });

    it('match relationships by the types of the nodes they join', () => {
        expect(connectsBetween(doc, 'service', 'database')).toBe(true);
        expect(connectsRelationshipsBetween(doc, 'service', 'database')).toHaveLength(1);
        expect(connectsRelationshipsBetween(doc, 'database', 'service')).toEqual([]);
        expect(connectsBetween(doc, 'database', 'service')).toBe(false);
        expect(interactsWith(doc, 'actor', 'service')).toBe(true);
        expect(interactsWith(doc, 'actor', 'database')).toBe(false);
        expect(composedOf(doc, 'system', ['service', 'database'])).toBe(true);
        expect(composedOf(doc, 'system', ['service', 'actor'])).toBe(false);
    });

    it('match a connects by the ids of the nodes it joins, in direction', () => {
        expect(connectsNodes(doc, 'svc', 'db')).toBe(true);
        expect(connectsNodes(doc, 'db', 'svc')).toBe(false);
        expect(connectsNodes(doc, 'web', 'svc')).toBe(false);
    });

    it('ignore relationships that point at missing nodes', () => {
        const dangling = { ...doc, relationships: [{ 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'gone' } } } }] };
        expect(connectsBetween(dangling, 'service', 'database')).toBe(false);
        expect(connectsNodes(dangling, 'svc', 'gone')).toBe(false);
    });
});

describe('completeNodes', () => {
    it('matches a node with all four required properties', () => {
        const complete = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'x' }] };
        expect(completeNodes(complete).map((node) => node['unique-id'])).toEqual(['a']);
    });

    it('does not match a node missing or blank on a required property', () => {
        const missingField = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A' }] };
        const blankField = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: '', description: 'x' }] };
        expect(completeNodes(missingField)).toEqual([]);
        expect(completeNodes(blankField)).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { nodes: [null, 3] }, { nodes: [{ 'unique-id': 1 }] }]) {
            expect(completeNodes(bad as never)).toEqual([]);
        }
    });

    it('only counts complete nodes among a mix', () => {
        const mixed = {
            nodes: [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'x' },
                { 'unique-id': 'b', 'node-type': 'service' },
            ],
        };
        expect(completeNodes(mixed)).toHaveLength(1);
    });
});

describe('nodeInterfaces', () => {
    it('matches interface items with a non-empty string unique-id', () => {
        const node = { interfaces: [{ 'unique-id': 'api', protocol: 'HTTPS' }, { protocol: 'HTTPS' }, { 'unique-id': '' }] };
        expect(nodeInterfaces(node).map((iface) => iface['unique-id'])).toEqual(['api']);
    });

    it('does not match when there are no usable interfaces', () => {
        expect(nodeInterfaces({ interfaces: [] })).toEqual([]);
        expect(nodeInterfaces({ interfaces: [{ protocol: 'HTTPS' }] })).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped node', () => {
        for (const bad of [null, undefined, {}, { interfaces: 'x' }, { interfaces: [null, 3] }]) {
            expect(nodeInterfaces(bad as never)).toEqual([]);
        }
    });
});

describe('connectsUsesInterfaces', () => {
    const withInterfaces = {
        nodes: [
            { 'unique-id': 'svc', 'node-type': 'service', interfaces: [{ 'unique-id': 'svc-api' }] },
            { 'unique-id': 'db', 'node-type': 'database', interfaces: [{ 'unique-id': 'db-jdbc' }] },
        ],
        relationships: [
            {
                'unique-id': 'r1',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc', interfaces: ['svc-api'] },
                        destination: { node: 'db', interfaces: ['db-jdbc'] },
                    },
                },
            },
        ],
    };

    it('matches a connects whose ends each reference one of that node\'s interfaces', () => {
        expect(connectsUsesInterfaces(withInterfaces, 'service', 'database')).toBe(true);
    });

    it('does not match when the connects names no interfaces', () => {
        const noInterfaces = {
            ...withInterfaces,
            relationships: [{
                'unique-id': 'r1',
                'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } },
            }],
        };
        expect(connectsUsesInterfaces(noInterfaces, 'service', 'database')).toBe(false);
        expect(connectsUsesInterfaces(withInterfaces, 'database', 'service')).toBe(false);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { nodes: 'x' }, { relationships: [{ 'relationship-type': null }] }]) {
            expect(connectsUsesInterfaces(bad as never, 'service', 'database')).toBe(false);
        }
    });

    it('does not match a dangling interface id: named on the relationship but absent from the node', () => {
        const dangling = {
            ...withInterfaces,
            relationships: [{
                'unique-id': 'r1',
                'relationship-type': {
                    connects: {
                        source: { node: 'svc', interfaces: ['does-not-exist'] },
                        destination: { node: 'db', interfaces: ['db-jdbc'] },
                    },
                },
            }],
        };
        expect(connectsUsesInterfaces(dangling, 'service', 'database')).toBe(false);
    });
});

describe('hasMetadata', () => {
    it('matches a non-empty metadata object', () => {
        expect(hasMetadata({ metadata: { owner: 'team' } })).toBe(true);
    });

    it('matches a non-empty array of non-empty metadata objects', () => {
        expect(hasMetadata({ metadata: [{ key: 'owner', value: 'team' }] })).toBe(true);
    });

    it('does not match an empty object, an empty array, or an array containing an empty object', () => {
        expect(hasMetadata({ metadata: {} })).toBe(false);
        expect(hasMetadata({ metadata: [] })).toBe(false);
        expect(hasMetadata({ metadata: [{ key: 'owner', value: 'team' }, {}] })).toBe(false);
    });

    it('never throws on a partial or wrong-shaped item', () => {
        for (const bad of [null, undefined, {}, { metadata: null }, { metadata: 'x' }, { metadata: 3 }, { metadata: [null, 3] }]) {
            expect(hasMetadata(bad as never)).toBe(false);
        }
    });
});

describe('controlsIn', () => {
    const configured = {
        controls: {
            security: {
                description: 'Data encryption requirements',
                requirements: [
                    { 'requirement-url': 'https://policy.example.com/encryption', config: { algorithm: 'AES-256' } },
                    { 'requirement-url': 'https://policy.example.com/tls', 'config-url': 'https://configs.example.com/tls.yaml' },
                ],
            },
        },
    };

    it('matches a domain whose requirements each have a requirement-url and a config or config-url', () => {
        expect(controlsIn(configured).map(([domain]) => domain)).toEqual(['security']);
    });

    it('does not match a domain with an empty requirements array', () => {
        const empty = { controls: { security: { description: 'x', requirements: [] } } };
        expect(controlsIn(empty)).toEqual([]);
    });

    it('does not match a requirement missing requirement-url, or missing both config and config-url', () => {
        const missingUrl = { controls: { security: { description: 'x', requirements: [{ config: { a: 1 } }] } } };
        const missingConfig = { controls: { security: { description: 'x', requirements: [{ 'requirement-url': 'https://x' }] } } };
        expect(controlsIn(missingUrl)).toEqual([]);
        expect(controlsIn(missingConfig)).toEqual([]);
    });

    it('only counts domains that pass among a mix', () => {
        const mixed = {
            controls: {
                security: configured.controls.security,
                compliance: { description: 'x', requirements: [] },
            },
        };
        expect(controlsIn(mixed).map(([domain]) => domain)).toEqual(['security']);
    });

    it('never throws on a partial or wrong-shaped item', () => {
        const bad = [
            null, undefined, {}, { controls: 'x' }, { controls: [] }, { controls: {} },
            { controls: { security: 'x' } }, { controls: { security: { requirements: 'x' } } },
            { controls: { security: { requirements: [null, 3] } } },
        ];
        for (const item of bad) {
            expect(controlsIn(item as never)).toEqual([]);
        }
    });
});

describe('relationshipsOfKind', () => {
    const doc2 = {
        relationships: [
            { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } }, metadata: { latency: '< 50ms' } },
            { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } },
        ],
    };

    it('matches relationships whose relationship-type has that kind', () => {
        expect(relationshipsOfKind(doc2, 'connects').map((rel) => rel['unique-id'])).toEqual(['r1']);
    });

    it('does not match when no relationship has that kind', () => {
        expect(relationshipsOfKind(doc2, 'deployed-in')).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { relationships: 'x' }, { relationships: [{ 'relationship-type': null }] }, { relationships: [{ 'relationship-type': { connects: 'x' } }] }]) {
            expect(relationshipsOfKind(bad as never, 'connects')).toEqual([]);
        }
    });
});

describe('flowsWithTransitions', () => {
    const flowDoc = {
        relationships: [
            { 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } } },
            { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'user', nodes: ['svc'] } } },
        ],
        flows: [
            {
                'unique-id': 'order-flow',
                name: 'Order flow',
                transitions: [
                    { 'relationship-unique-id': 'r2', 'sequence-number': 1, description: 'a' },
                    { 'relationship-unique-id': 'r1', 'sequence-number': 2, description: 'b' },
                ],
            },
        ],
    };

    it('matches a flow whose transitions all resolve, at or above the minimum count', () => {
        expect(flowsWithTransitions(flowDoc, 2).map((flow) => flow['unique-id'])).toEqual(['order-flow']);
        expect(flowsWithTransitions(flowDoc, 3)).toEqual([]);
    });

    it('does not match a transition naming a relationship id that does not exist', () => {
        const dangling = {
            ...flowDoc,
            flows: [{
                'unique-id': 'order-flow',
                name: 'Order flow',
                transitions: [
                    { 'relationship-unique-id': 'r2', 'sequence-number': 1, description: 'a' },
                    { 'relationship-unique-id': 'does-not-exist', 'sequence-number': 2, description: 'b' },
                ],
            }],
        };
        expect(flowsWithTransitions(dangling, 2)).toEqual([]);
    });

    it('does not match a flow missing a unique-id or name, or a transition without a numeric sequence-number', () => {
        const noName = { ...flowDoc, flows: [{ 'unique-id': 'order-flow', transitions: flowDoc.flows[0].transitions }] };
        const badSequence = {
            ...flowDoc,
            flows: [{
                'unique-id': 'order-flow',
                name: 'Order flow',
                transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': '2', description: 'b' }],
            }],
        };
        expect(flowsWithTransitions(noName, 1)).toEqual([]);
        expect(flowsWithTransitions(badSequence, 1)).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        const bad = [
            null, undefined, {}, { flows: 'x' }, { flows: [null, 3] }, { flows: [{ transitions: 'x' }] },
            { flows: [{ 'unique-id': 'f', name: 'F', transitions: [null, 3] }] },
        ];
        for (const item of bad) {
            expect(flowsWithTransitions(item as never, 1)).toEqual([]);
        }
    });
});

const outcome = (over: Partial<CommandOutcome>): CommandOutcome => ({
    command: 'validate',
    files: { architecture: '/workspace/a.json' },
    ok: true,
    errorCount: 0,
    warningCount: 0,
    snapshot: { '/workspace/a.json': 'v1' },
    ...over,
});
const state = (commands: CommandOutcome[]): LessonState => ({ doc: null, validation: { ok: true }, commands, editorFile: '/workspace/a.json', files: {} });

describe('pattern helpers', () => {
    const item = (id?: unknown) => ({ properties: { 'unique-id': { const: id } } });
    const tuple = (count: number, over: Record<string, unknown> = {}) =>
        ({ type: 'array', minItems: count, maxItems: count, prefixItems: Array.from({ length: count }, (_, i) => item(`n${i}`)), ...over });
    const pattern = { properties: { nodes: tuple(3), relationships: tuple(2) } };

    it('patternRequires counts prefixItems when minItems and maxItems equal that count', () => {
        expect(patternRequires(pattern)).toEqual({ nodes: 3, relationships: 2 });
        expect(patternRequires({ properties: { nodes: tuple(4) } })).toEqual({ nodes: 4, relationships: 0 });
    });

    it('patternRequires gives 0 when the count is not exact', () => {
        expect(patternRequires({ properties: { nodes: tuple(3, { maxItems: undefined }), relationships: tuple(2, { minItems: 1 }) } }))
            .toEqual({ nodes: 0, relationships: 0 });
        expect(patternRequires({ properties: { nodes: tuple(3, { minItems: 4, maxItems: 4 }) } })).toEqual({ nodes: 0, relationships: 0 });
    });

    it.each([
        ['null', null],
        ['an empty object', {}],
        ['a properties array', { properties: [] }],
        ['a prefixItems string', { properties: { nodes: { minItems: 1, maxItems: 1, prefixItems: 'x' } } }],
        ['a nodes string', { properties: { nodes: 'x', relationships: null } }],
    ])('patternRequires and patternNodeIds do not throw on %s', (_, json) => {
        expect(patternRequires(json as never)).toEqual({ nodes: 0, relationships: 0 });
        expect(patternNodeIds(json as never)).toEqual([]);
        expect(patternNodeTypes(json as never)).toEqual([]);
        expect(patternConnects(json as never)).toEqual([]);
        expect(patternItemConsts(json as never, 'nodes')).toEqual([]);
    });

    it('patternItemConsts reads the const properties of each item and skips the rest', () => {
        const json = {
            properties: {
                nodes: { prefixItems: [
                    { properties: { 'unique-id': { const: 'a' }, name: { const: 'A' }, description: { type: 'string' } } },
                    { type: 'object' },
                ] },
                relationships: { prefixItems: [{ properties: { 'relationship-type': { const: { connects: {} } } } }] },
            },
        };
        expect(patternItemConsts(json, 'nodes')).toEqual([{ 'unique-id': 'a', name: 'A' }, {}]);
        expect(patternItemConsts(json, 'relationships')).toEqual([{ 'relationship-type': { connects: {} } }]);
    });

    it('patternNodeTypes and patternConnects read the const node-type and connects of each item', () => {
        const typed = (id: string, type?: string) => ({ properties: { 'unique-id': { const: id }, ...(type ? { 'node-type': { const: type } } : {}) } });
        const link = (id: string | undefined, source: string, destination: string) => ({
            properties: {
                ...(id ? { 'unique-id': { const: id } } : {}),
                'relationship-type': { const: { connects: { source: { node: source }, destination: { node: destination } } } },
            },
        });
        const json = {
            properties: {
                nodes: { prefixItems: [typed('a', 'webclient'), typed('b')] },
                relationships: { prefixItems: [link('r1', 'a', 'b'), link(undefined, 'a', 'b'), { properties: { 'unique-id': { const: 'r3' } } }] },
            },
        };
        expect(patternNodeTypes(json)).toEqual(['webclient', undefined]);
        expect(patternConnects(json)).toEqual([{ source: 'a', destination: 'b' }, undefined, undefined]);
    });

    it('patternNodeIds reads the const unique-id of each required node, and skips items without one', () => {
        expect(patternNodeIds(pattern)).toEqual(['n0', 'n1', 'n2']);
        expect(patternNodeIds({ properties: { nodes: { prefixItems: [item('a'), item(3), item(), {}, null, item('')] } } })).toEqual(['a']);
    });

    it('hasDescription needs a non-empty string description', () => {
        expect(hasDescription({ description: 'Calls the API.' })).toBe(true);
        expect(hasDescription({ description: '' })).toBe(false);
        expect(hasDescription({ description: 3 })).toBe(false);
        expect(hasDescription({})).toBe(false);
        expect(hasDescription(null)).toBe(false);
    });

    it('hasPlaceholder finds a [[ NAME ]] string anywhere in a value', () => {
        expect(hasPlaceholder({ nodes: [{ description: '[[ DESCRIPTION ]]' }] })).toBe(true);
        expect(hasPlaceholder(['x', { a: { b: '[[HOST]]' } }])).toBe(true);
        expect(hasPlaceholder({ nodes: [{ description: 'A service. See [[ notes ]] later.' }], port: -1 })).toBe(false);
        expect(hasPlaceholder(null)).toBe(false);
    });
});

describe('patternRefs', () => {
    const NODE_STD = 'https://example.com/standards/node.json';
    const REL_STD = 'https://example.com/standards/relationship.json';

    it('collects every string $ref at any depth, once each', () => {
        const pattern = {
            properties: {
                nodes: { type: 'array', items: { $ref: NODE_STD } },
                relationships: { type: 'array', items: { allOf: [{ $ref: REL_STD }, { $ref: NODE_STD }] } },
            },
        };
        expect(patternRefs(pattern)).toEqual([NODE_STD, REL_STD]);
    });

    it('finds refs under prefixItems too, and none in a pattern without refs', () => {
        expect(patternRefs({ properties: { nodes: { prefixItems: [{ $ref: NODE_STD }] } } })).toEqual([NODE_STD]);
        expect(patternRefs({ properties: {} })).toEqual([]);
    });

    it.each([
        ['null', null],
        ['a string', 'x'],
        ['a non-string $ref', { $ref: 3, items: { $ref: '' } }],
        ['a $ref object', { $ref: { $ref: NODE_STD } }],
    ])('does not throw on %s', (_, json) => {
        expect(() => patternRefs(json)).not.toThrow();
    });

    it('skips empty and non-string $ref values', () => {
        expect(patternRefs({ $ref: 3, items: { $ref: '' } })).toEqual([]);
    });

    it('patternArrayRefs reads only the refs in the items schema of properties.nodes or properties.relationships', () => {
        const pattern = {
            $defs: { other: { $ref: 'https://example.com/elsewhere.json' } },
            properties: { nodes: { items: { $ref: NODE_STD } }, relationships: { items: { allOf: [{ $ref: REL_STD }] } } },
        };
        expect(patternArrayRefs(pattern, 'nodes')).toEqual([NODE_STD]);
        expect(patternArrayRefs(pattern, 'relationships')).toEqual([REL_STD]);
        expect(patternArrayRefs({ $defs: { nodes: { $ref: NODE_STD } }, properties: {} }, 'nodes')).toEqual([]);
        expect(patternArrayRefs({ properties: { nodes: 'x' } }, 'nodes')).toEqual([]);
        expect(patternArrayRefs(null, 'relationships')).toEqual([]);
        // Only some elements must match a prefixItems or contains schema.
        expect(patternArrayRefs({ properties: { nodes: { prefixItems: [{ $ref: NODE_STD }], contains: { $ref: NODE_STD } } } }, 'nodes')).toEqual([]);
        // The element may match something else, or must not match the Standard.
        expect(patternArrayRefs({ properties: { nodes: { items: { anyOf: [{ $ref: NODE_STD }, {}] } } } }, 'nodes')).toEqual([]);
        expect(patternArrayRefs({ properties: { nodes: { items: { not: { $ref: NODE_STD } } } } }, 'nodes')).toEqual([]);
        expect(patternArrayRefs({ properties: { nodes: { items: { allOf: [{ anyOf: [{ $ref: NODE_STD }] }] } } } }, 'nodes')).toEqual([]);
    });
});

describe('url mapping helpers', () => {
    const NODE_URL = 'https://example.com/standards/node.json';
    const withFiles = (files: Record<string, string>): LessonState =>
        ({ doc: null, validation: { ok: true }, commands: [], editorFile: '/workspace/a.json', files });
    const mapping = (entries: Record<string, unknown>, path = '/workspace/url-mapping.json') => ({ [path]: JSON.stringify(entries) });

    it('resolves each path against the mapping file\'s folder, and keeps the ones that exist', () => {
        const state = withFiles({
            ...mapping({ [NODE_URL]: 'standards/node.json', 'https://example.com/missing.json': 'standards/missing.json' }),
            '/workspace/standards/node.json': '{}',
        });
        expect(urlMappingTargets(state, '/workspace/url-mapping.json')).toEqual({ [NODE_URL]: '/workspace/standards/node.json' });
        expect(urlMappingEntries(state, '/workspace/url-mapping.json')).toEqual([
            { url: NODE_URL, path: '/workspace/standards/node.json', exists: true },
            { url: 'https://example.com/missing.json', path: '/workspace/standards/missing.json', exists: false },
        ]);
    });

    it('resolves ../ and ./ paths from a mapping in a subfolder, and absolute paths as they are', () => {
        const state = withFiles({
            ...mapping({ [NODE_URL]: '../standards/node.json', a: './local.json', b: '/workspace/standards/node.json' }, '/workspace/config/url-mapping.json'),
            '/workspace/standards/node.json': '{}',
            '/workspace/config/local.json': '{}',
        });
        expect(urlMappingTargets(state, '/workspace/config/url-mapping.json')).toEqual({
            [NODE_URL]: '/workspace/standards/node.json',
            a: '/workspace/config/local.json',
            b: '/workspace/standards/node.json',
        });
    });

    it('does not resolve against the working directory', () => {
        const state = withFiles({
            ...mapping({ [NODE_URL]: 'standards/node.json' }, '/workspace/config/url-mapping.json'),
            '/workspace/standards/node.json': '{}',
        });
        expect(urlMappingTargets(state, '/workspace/config/url-mapping.json')).toEqual({});
    });

    it('marks a value that is not a non-empty string as missing', () => {
        const state = withFiles({ ...mapping({ a: 3, b: '', c: null }), '/workspace/3': '{}' });
        expect(urlMappingEntries(state, '/workspace/url-mapping.json').every((entry) => !entry.exists)).toBe(true);
        expect(urlMappingTargets(state, '/workspace/url-mapping.json')).toEqual({});
    });

    it.each([
        ['a missing file', {}],
        ['a half-edited file', { '/workspace/url-mapping.json': '{"https://example.com/a": "sta' }],
        ['an array', { '/workspace/url-mapping.json': '["standards/node.json"]' }],
    ])('gives nothing for %s', (_, files) => {
        expect(urlMappingEntries(withFiles(files), '/workspace/url-mapping.json')).toEqual([]);
        expect(urlMappingTargets(withFiles(files), '/workspace/url-mapping.json')).toEqual({});
    });
});

describe('standardRequires', () => {
    const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
    const RELATIONSHIP_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship';

    it('reads the required property names when an allOf entry $refs the named core definition', () => {
        const standard = {
            allOf: [
                { $ref: NODE_REF },
                { type: 'object', properties: { costCenter: {}, owner: {} }, required: ['costCenter', 'owner'] },
            ],
        };
        expect(standardRequires(standard, 'node')).toEqual(['costCenter', 'owner']);
        const relationshipStandard = {
            allOf: [{ $ref: RELATIONSHIP_REF }, { required: ['dataClassification', 'encrypted'] }],
        };
        expect(standardRequires(relationshipStandard, 'relationship')).toEqual(['dataClassification', 'encrypted']);
    });

    it('unions and deduplicates required names split across allOf entries', () => {
        const standard = {
            allOf: [
                { $ref: NODE_REF },
                { required: ['costCenter'] },
                { required: ['owner', 'costCenter'] },
            ],
        };
        expect(standardRequires(standard, 'node')).toEqual(['costCenter', 'owner']);
    });

    it('reads a top-level required array, sibling to allOf, once the $ref is inside allOf', () => {
        const standard = {
            allOf: [{ $ref: NODE_REF }],
            required: ['costCenter', 'owner'],
        };
        expect(standardRequires(standard, 'node')).toEqual(['costCenter', 'owner']);
    });

    it('unions and deduplicates a top-level required array with allOf entries\' required arrays', () => {
        const standard = {
            allOf: [{ $ref: NODE_REF }, { required: ['owner'] }],
            required: ['costCenter', 'owner'],
        };
        expect(standardRequires(standard, 'node')).toEqual(['owner', 'costCenter']);
    });

    it('gives [] when there is no allOf', () => {
        expect(standardRequires({ $id: 'https://example.com/s.json', title: 'Stub' }, 'node')).toEqual([]);
        expect(standardRequires({ allOf: 'x' }, 'node')).toEqual([]);
        // A top-level required with no allOf $ref at all is not a Standard.
        expect(standardRequires({ required: ['costCenter'] }, 'node')).toEqual([]);
    });

    it('gives [] when no allOf entry $refs the named core definition', () => {
        const wrongDef = {
            allOf: [
                { $ref: RELATIONSHIP_REF },
                { required: ['costCenter'] },
            ],
            required: ['owner'],
        };
        expect(standardRequires(wrongDef, 'node')).toEqual([]);
        const wrongUrl = { allOf: [{ $ref: 'https://calm.finos.org/release/1.1/meta/core.json#/defs/node' }, { required: ['costCenter'] }] };
        expect(standardRequires(wrongUrl, 'node')).toEqual([]);
    });

    it('never throws on a partial or wrong-shaped document', () => {
        for (const bad of [null, undefined, {}, { allOf: null }, { allOf: [null, 3, 'x'] }, { allOf: [{ $ref: NODE_REF, required: 'x' }] }, { allOf: [{ $ref: NODE_REF }], required: 'x' }]) {
            expect(standardRequires(bad as never, 'node')).toEqual([]);
            expect(standardRequires(bad as never, 'relationship')).toEqual([]);
        }
    });
});

describe('command outcomes', () => {
    it('drop an outcome once a file it read has changed', () => {
        const files: Record<string, string> = { '/workspace/a.json': 'v2' };
        expect(freshOutcomes([outcome({})], (path) => files[path] ?? null)).toEqual([]);
        files['/workspace/a.json'] = 'v1';
        expect(freshOutcomes([outcome({})], (path) => files[path] ?? null)).toHaveLength(1);
    });

    it('match by command and resolved files', () => {
        const s = state([outcome({}), outcome({ command: 'diff', ok: false, files: { documentA: '/workspace/a.json', documentB: '/workspace/b.json' } })]);
        expect(ranOk(s, 'validate')).toBe(true);
        expect(ranOk(s, 'validate', { architecture: '/workspace/a.json' })).toBe(true);
        expect(ranOk(s, 'validate', { architecture: '/workspace/b.json' })).toBe(false);
        expect(ranOk(s, 'diff')).toBe(false);
        expect(ranFailed(s, 'diff', { documentB: '/workspace/b.json' })).toBe(true);
        expect(validatedEditorFile(s)).toBe(true);
    });
});

describe('rejected', () => {
    const files = { architecture: '/workspace/a.json', pattern: '/workspace/p.json' };
    const failed = (over: Partial<CommandOutcome>) => outcome({ files, ok: false, errorCount: 2, loadFailures: 0, ...over });

    it('accepts a validate whose every error is in the architecture', () => {
        expect(rejected(state([failed({ errorsIn: { architecture: 2 } })]), files)).toBe(true);
        expect(rejected(state([failed({ errorsIn: { architecture: 2 } })]), { architecture: '/workspace/b.json' })).toBe(false);
    });

    it.each([
        ['a pattern error', { errorsIn: { architecture: 1, pattern: 1 } }],
        ['only pattern errors', { errorsIn: { pattern: 2 } }],
        ['an error from another source', { errorsIn: { architecture: 1, other: 1 } }],
        ['a $ref that failed to load', { errorsIn: { architecture: 2 }, loadFailures: 1 }],
        ['no per-source counts', {}],
    ])('does not accept a failure with %s', (_, over: Partial<CommandOutcome>) => {
        expect(rejected(state([failed(over)]), files)).toBe(false);
    });

    it('does not accept a passing validate or another command', () => {
        expect(rejected(state([outcome({ files, errorsIn: {}, loadFailures: 0 })]), files)).toBe(false);
        expect(rejected(state([failed({ command: 'diff', errorsIn: { architecture: 2 } })]), files)).toBe(false);
    });
});

describe('workspace file helpers', () => {
    const withFiles = (files: Record<string, string>): LessonState =>
        ({ doc: null, validation: { ok: true }, commands: [], editorFile: '/workspace/a.json', files });

    it('fileText returns the saved text, or null for a missing file', () => {
        const state = withFiles({ '/workspace/docs/adr.md': '# ADR' });
        expect(fileText(state, '/workspace/docs/adr.md')).toBe('# ADR');
        expect(fileText(state, '/workspace/missing.md')).toBeNull();
        expect(fileText(withFiles({ '/workspace/empty.md': '' }), '/workspace/empty.md')).toBe('');
    });

    it('fileJson parses a JSON object, and gives null for a missing, non-JSON or non-object file', () => {
        const state = withFiles({
            '/workspace/a.json': '{"nodes": []}',
            '/workspace/adr.md': '# not json',
            '/workspace/half.json': '{"nodes": [',
            '/workspace/list.json': '[1, 2]',
            '/workspace/num.json': '3',
            '/workspace/null.json': 'null',
        });
        expect(fileJson(state, '/workspace/a.json')).toEqual({ nodes: [] });
        for (const path of ['/workspace/missing.json', '/workspace/adr.md', '/workspace/half.json', '/workspace/list.json', '/workspace/num.json', '/workspace/null.json']) {
            expect(fileJson(state, path), path).toBeNull();
        }
    });

    describe('markdownSection', () => {
        const adr = [
            '# ADR 1: Use a queue',
            '',
            '## Status',
            'Accepted',
            '',
            '## Context',
            '',
            'Orders arrive in bursts.',
            '### Detail',
            'Peaks of 10k/s.',
            '',
            '## Decision',
            '  Use a message queue.  ',
            '',
        ].join('\n');

        it('returns the trimmed body under a level-2 heading, keeping deeper headings', () => {
            expect(markdownSection(adr, 'Status')).toBe('Accepted');
            expect(markdownSection(adr, 'Context')).toBe('Orders arrive in bursts.\n### Detail\nPeaks of 10k/s.');
        });

        it('returns the last section up to the end of the file', () => {
            expect(markdownSection(adr, 'Decision')).toBe('Use a message queue.');
        });

        it('matches the heading case-insensitively and ignores extra spaces', () => {
            expect(markdownSection('##   status  \nAccepted', 'Status')).toBe('Accepted');
        });

        it('ends a section at the next level-1 heading', () => {
            expect(markdownSection('## A\none\n# B\ntwo', 'A')).toBe('one');
        });

        it('handles Windows line endings', () => {
            expect(markdownSection('## Status\r\nAccepted\r\n## Next\r\nx', 'Status')).toBe('Accepted');
        });

        it('returns an empty string when the heading is absent or only at another level', () => {
            expect(markdownSection(adr, 'Consequences')).toBe('');
            expect(markdownSection('### Status\nAccepted', 'Status')).toBe('');
            expect(markdownSection('# Status\nAccepted', 'Status')).toBe('');
            expect(markdownSection('## Statuses\nAccepted', 'Status')).toBe('');
        });

        it('keeps fenced code in the body, even lines that start with #', () => {
            const text = '## Decision\nRun:\n```sh\n# a shell comment\n```\nThen deploy.\n## Next\nx';
            expect(markdownSection(text, 'Decision')).toBe('Run:\n```sh\n# a shell comment\n```\nThen deploy.');
            expect(markdownSection('~~~\n## Status\n~~~\n## Status\nAccepted', 'Status')).toBe('Accepted');
        });

        it('strips only a closing # sequence that follows a space', () => {
            expect(markdownSection('## C#\nyes', 'C#')).toBe('yes');
            expect(markdownSection('## Status ##\nAccepted', 'Status')).toBe('Accepted');
        });

        it('never throws', () => {
            expect(markdownSection(null, 'Status')).toBe('');
            expect(markdownSection('', 'Status')).toBe('');
            expect(markdownSection('## Status', 'Status')).toBe('');
            expect(markdownSection('## (a+\nx', '(a+')).toBe('x');
        });
    });

    describe('filledAdr', () => {
        const filled = [
            '## Status', 'Accepted', '',
            '## Context', 'Orders arrive in bursts.', '',
            '## Decision', 'Use a message queue.', '',
            '## Consequences', '### Positive', 'Faster order confirmation.', '',
        ].join('\n');

        it('is true when every ADR section has a non-empty, non-TODO body', () => {
            expect(filledAdr(filled)).toBe(true);
        });

        it('is false when a section is missing or empty', () => {
            expect(filledAdr('## Status\nAccepted\n## Context\nBursts.\n## Decision\nUse a queue.')).toBe(false);
            expect(filledAdr(filled.replace('Accepted', ''))).toBe(false);
        });

        it('is false when a section body still starts with TODO', () => {
            expect(filledAdr(filled.replace('Accepted', 'TODO: fill this in'))).toBe(false);
        });

        it('is true when the prose mentions todo outside a placeholder', () => {
            expect(filledAdr(filled.replace('Orders arrive in bursts.', 'The legacy todo queue and a Todo-list API drop orders.'))).toBe(true);
        });

        it('is false when a TODO placeholder is left after some prose', () => {
            expect(filledAdr(filled.replace('Accepted', 'Accepted\nTODO: state whether this decision is proposed'))).toBe(false);
        });

        it('never throws on missing or unrelated text', () => {
            expect(filledAdr(null)).toBe(false);
            expect(filledAdr('')).toBe(false);
            expect(filledAdr('not an adr at all')).toBe(false);
        });
    });

    describe('linkedAdrs', () => {
        const state = (over: Partial<LessonState> = {}): LessonState =>
            ({ doc: null, validation: { ok: true }, commands: [], editorFile: '/workspace/a.json', files: {}, ...over });

        it('resolves relative adrs entries against the workspace and keeps only ones that exist', () => {
            const s = state({
                doc: { adrs: ['docs/adr/0001-x.md', 'docs/adr/missing.md'] },
                files: { '/workspace/docs/adr/0001-x.md': '# ADR' },
            });
            expect(linkedAdrs(s)).toEqual(['/workspace/docs/adr/0001-x.md']);
        });

        it('drops non-string entries and external URLs, which can never be a workspace file', () => {
            const s = state({
                doc: { adrs: ['https://wiki.example.com/adr-1', 42, null, 'docs/adr/0001-x.md'] },
                files: { '/workspace/docs/adr/0001-x.md': '# ADR' },
            });
            expect(linkedAdrs(s)).toEqual(['/workspace/docs/adr/0001-x.md']);
        });

        it('deduplicates repeated entries', () => {
            const s = state({
                doc: { adrs: ['docs/adr/0001-x.md', 'docs/adr/0001-x.md'] },
                files: { '/workspace/docs/adr/0001-x.md': '# ADR' },
            });
            expect(linkedAdrs(s)).toEqual(['/workspace/docs/adr/0001-x.md']);
        });

        it('never throws on a partial or wrong-shaped document', () => {
            for (const bad of [null, undefined, {}, { adrs: 'not-an-array' }, { adrs: [{}] }]) {
                expect(linkedAdrs(state({ doc: bad as never }))).toEqual([]);
            }
        });
    });
});

describe('standardExample', () => {
    const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';

    it('gives a value for each required property: the given one, else by enum or type', () => {
        const standard = {
            allOf: [
                { $ref: NODE_REF },
                {
                    properties: { tier: { enum: ['gold', 'silver'] }, audited: { type: 'boolean' }, replicas: { type: 'integer' } },
                    required: ['owner', 'tier', 'audited', 'replicas', 'team'],
                },
            ],
            properties: { team: { type: 'string' } },
        };
        expect(standardExample(standard, 'node', { owner: 'payments', extra: 1 }))
            .toEqual({ owner: 'payments', tier: 'gold', audited: true, replicas: 0, team: 'example' });
    });

    it('gives {} when the document is not a Standard for the named core definition', () => {
        expect(standardExample({ allOf: [{ $ref: NODE_REF }, { required: ['owner'] }] }, 'relationship')).toEqual({});
        expect(standardExample(null, 'node')).toEqual({});
    });

    it('skips a given value the property schema rejects', () => {
        const standard = {
            allOf: [{ $ref: NODE_REF }, {
                properties: {
                    tier: { enum: ['low', 'high'] },
                    costCenter: { type: 'string', pattern: '^[0-9]+$' },
                    region: { type: 'string', pattern: '^[a-z]{2}-[0-9]$', examples: ['eu-1'] },
                },
                required: ['tier', 'costCenter', 'region'],
            }],
        };
        expect(standardExample(standard, 'node', { tier: 'internal', costCenter: 'CC-1234', region: 'Europe' }))
            .toEqual({ tier: 'low', costCenter: '0', region: 'eu-1' });
    });
});

describe('withStandard', () => {
    const NODE_REF = 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node';
    const tutorial = { allOf: [{ $ref: NODE_REF }, { properties: { costCenter: {}, environment: {} }, required: ['costCenter'] }] };

    it('drops the tutorial Standard\'s properties and adds the ones the learner\'s Standard requires', () => {
        const standard = { allOf: [{ $ref: NODE_REF }, { properties: { team: { type: 'string' } }, required: ['team'] }] };
        expect(withStandard({ 'unique-id': 'a', costCenter: 'CC-1', environment: 'dev' }, 'node', standard, tutorial))
            .toEqual({ 'unique-id': 'a', team: 'example' });
    });

    it('keeps a tutorial value that the learner\'s Standard accepts', () => {
        expect(withStandard({ 'unique-id': 'a', costCenter: 'CC-1', environment: 'dev' }, 'node', tutorial, tutorial))
            .toEqual({ 'unique-id': 'a', costCenter: 'CC-1' });
    });
});

describe('everyHas', () => {
    const names = ['owner', 'costCenter'];

    it('passes when every item has every name', () => {
        expect(everyHas([{ owner: 'a', costCenter: 'CC-1' }, { owner: 'b', costCenter: 'CC-2', extra: 1 }], names)).toBe(true);
    });

    it('fails when one item misses a name', () => {
        expect(everyHas([{ owner: 'a', costCenter: 'CC-1' }, { owner: 'b' }], names)).toBe(false);
    });

    it('fails for an empty names list, so a Standard that requires nothing completes no step', () => {
        expect(everyHas([{ owner: 'a' }], [])).toBe(false);
    });

    it('fails for no items', () => {
        expect(everyHas([], names)).toBe(false);
    });

    it('fails on wrong-shaped input and never throws', () => {
        expect(everyHas(null, names)).toBe(false);
        expect(everyHas(undefined, names)).toBe(false);
        expect(everyHas({ owner: 'a', costCenter: 'CC-1' }, names)).toBe(false);
        expect(everyHas([null, { owner: 'a', costCenter: 'CC-1' }], names)).toBe(false);
        expect(everyHas(['owner', 42], names)).toBe(false);
        expect(everyHas([['owner', 'costCenter']], names)).toBe(false);
    });
});
