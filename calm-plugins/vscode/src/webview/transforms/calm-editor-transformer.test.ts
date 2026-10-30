import { describe, it, expect, beforeEach } from 'vitest';
import type { Node, Edge } from 'reactflow';
import { flowToCalm, relayoutByPath, setLastParsedArch } from './calm-editor-transformer';
import type { CalmArchitecture } from './calm-editor-transformer';
import { parseCALMData } from './calm-parser';

describe('flowToCalm - definition-id handling', () => {
    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('writes definition-id and omits controls/metadata for Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'svc-1',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'svc-1',
                    calmType: 'service',
                    label: 'Payment Service',
                    description: 'Handles payments',
                    interfaces: [{ id: 'iface-1', protocol: 'https' }],
                    'definition-id': 'finos:standard-nodes:microservice@abc123',
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'finos:standard-nodes:microservice@abc123'
        );
        expect(calmNode['unique-id']).toBe('svc-1');
        expect(calmNode.name).toBe('Payment Service');
        expect(calmNode.interfaces).toEqual([
            { id: 'iface-1', protocol: 'https' },
        ]);
        // Controls and metadata should NOT be present
        expect(calmNode.controls).toBeUndefined();
        expect(calmNode.metadata).toBeUndefined();
    });

    it('writes controls and metadata for local nodes (no definition-id)', () => {
        const nodes: Node[] = [
            {
                id: 'svc-2',
                type: 'service',
                position: { x: 100, y: 100 },
                data: {
                    calmId: 'svc-2',
                    calmType: 'service',
                    label: 'Local Service',
                    description: 'A locally defined service',
                    interfaces: [],
                    controls: { 'app-id': { description: 'App ID' } },
                    metadata: { 'source-standard-node': 'microservice' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(1);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBeUndefined();
        expect(calmNode.controls).toEqual({
            'app-id': { description: 'App ID' },
        });
        expect(calmNode.metadata).toEqual({
            'source-standard-node': 'microservice',
        });
    });

    it('handles a mix of Hub-sourced and local nodes', () => {
        const nodes: Node[] = [
            {
                id: 'hub-node',
                type: 'service',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'hub-node',
                    calmType: 'service',
                    label: 'Hub Node',
                    description: '',
                    'definition-id': 'acme:standard-nodes:api-gateway@sha256',
                },
            },
            {
                id: 'local-node',
                type: 'database',
                position: { x: 200, y: 0 },
                data: {
                    calmId: 'local-node',
                    calmType: 'database',
                    label: 'Local DB',
                    description: '',
                    controls: { encryption: { description: 'AES256' } },
                    metadata: { 'source-standard-node': 'rds' },
                },
            },
        ];
        const edges: Edge[] = [];

        const arch = flowToCalm(nodes, edges);

        expect(arch.nodes).toHaveLength(2);

        const hubCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'hub-node'
        )!;
        expect(hubCalm['definition-id']).toBe(
            'acme:standard-nodes:api-gateway@sha256'
        );
        expect(hubCalm.controls).toBeUndefined();
        expect(hubCalm.metadata).toBeUndefined();

        const localCalm = arch.nodes.find(
            (n) => n['unique-id'] === 'local-node'
        )!;
        expect(localCalm['definition-id']).toBeUndefined();
        expect(localCalm.controls).toEqual({
            encryption: { description: 'AES256' },
        });
        expect(localCalm.metadata).toEqual({
            'source-standard-node': 'rds',
        });
    });

    it('preserves details on Hub-sourced nodes', () => {
        const nodes: Node[] = [
            {
                id: 'n1',
                type: 'system',
                position: { x: 0, y: 0 },
                data: {
                    calmId: 'n1',
                    calmType: 'system',
                    label: 'System',
                    description: '',
                    'definition-id': 'org:standard-nodes:platform@v1',
                    details: { 'detailed-architecture': 'sub-arch.calm.json' },
                },
            },
        ];

        const arch = flowToCalm(nodes, []);
        const calmNode = arch.nodes[0];
        expect(calmNode['definition-id']).toBe(
            'org:standard-nodes:platform@v1'
        );
        expect(calmNode.details).toEqual({
            'detailed-architecture': 'sub-arch.calm.json',
        });
    });

    it('stripResolvedNoise preserves description and config-url on controls', () => {
        const nodes: Node[] = [{
            id: 'svc-hub',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-hub',
                calmType: 'service',
                label: 'Hub Service',
                description: 'From Hub',
                'definition-id': 'finos:standard-nodes:svc@abc',
                controls: {
                    'platform--encryption': {
                        description: 'Data at rest encryption',
                        requirements: [{
                            'requirement-url': 'platform:controls:encryption@1.0.0',
                            'config-url': 'https://hub/config.json',
                        }],
                        metadata: { validation: { identity: { controlId: 'encryption' }, properties: {} } },
                    },
                },
            },
        }];

        const arch = flowToCalm(nodes, []);
        const ctrl = arch.nodes[0].controls as Record<string, any>;
        expect(ctrl['platform--encryption'].description).toBe('Data at rest encryption');
        expect(ctrl['platform--encryption'].requirements[0]['config-url']).toBe('https://hub/config.json');
        expect(ctrl['platform--encryption'].requirements[0]['requirement-url']).toBe('platform:controls:encryption@1.0.0');
        expect(ctrl['platform--encryption'].metadata).toBeUndefined();
    });

    it('preserves metadata on definition-id nodes', () => {
        const nodes: Node[] = [{
            id: 'svc-meta',
            type: 'service',
            position: { x: 0, y: 0 },
            data: {
                calmId: 'svc-meta',
                calmType: 'service',
                label: 'Styled Hub Node',
                description: '',
                'definition-id': 'finos:standard-nodes:svc@abc',
                metadata: { 'standard-node-style': { background: '#1c4587' } },
            },
        }];

        const arch = flowToCalm(nodes, []);
        expect(arch.nodes[0].metadata).toEqual({ 'standard-node-style': { background: '#1c4587' } });
    });
});

describe('flowToCalm - nodes with several parents', () => {
    const node = (id: string) => ({ 'unique-id': id, 'node-type': 'system', name: id, description: id });
    const deployedIn = (id: string, container: string, nodes: string[]) =>
        ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
    const sharedNamespace = (): CalmArchitecture => ({
        nodes: [node('cluster-a'), node('cluster-b'), node('ns'), node('svc'), node('client')],
        relationships: [
            deployedIn('r1', 'cluster-a', ['ns']),
            deployedIn('r2', 'cluster-b', ['ns']),
            deployedIn('r3', 'ns', ['svc']),
            { 'unique-id': 'c1', 'relationship-type': { connects: { source: { node: 'client' }, destination: { node: 'svc' } } } },
        ],
    });
    const roundTrip = (arch: CalmArchitecture) => {
        setLastParsedArch(arch);
        const parsed = parseCALMData(arch);
        return { parsed, out: flowToCalm(parsed.nodes, parsed.edges) };
    };
    const containment = (out: CalmArchitecture) =>
        out.relationships
            .filter((r) => (r['relationship-type'] as Record<string, unknown>)['deployed-in'])
            .map((r) => [r['unique-id'], (r['relationship-type'] as any)['deployed-in']]);

    beforeEach(() => {
        setLastParsedArch(null);
    });

    it('keeps every container membership of a node', () => {
        const { out } = roundTrip(sharedNamespace());
        expect(containment(out)).toEqual([
            ['r1', { container: 'cluster-a', nodes: ['ns'] }],
            ['r2', { container: 'cluster-b', nodes: ['ns'] }],
            ['r3', { container: 'ns', nodes: ['svc'] }],
        ]);
    });

    it('writes each node once', () => {
        const { out } = roundTrip(sharedNamespace());
        expect(out.nodes.map((n) => n['unique-id'])).toEqual(['cluster-a', 'cluster-b', 'ns', 'svc', 'client']);
    });

    it('writes the original ids for an edge drawn to a copy', () => {
        const { parsed } = roundTrip(sharedNamespace());
        const edges: Edge[] = [{
            id: 'c2', source: 'client', target: 'svc__in__ns__in__cluster-a',
            data: { calmRelId: 'c2', calmVariant: 'connects' },
        }];
        const out = flowToCalm(parsed.nodes, edges);
        expect(out.relationships.find((r) => r['unique-id'] === 'c2')?.['relationship-type']).toEqual({
            connects: { source: { node: 'client' }, destination: { node: 'svc' } },
        });
    });

    it('keeps the order of containment relationships, so the same drawing stays the original', () => {
        const arch = sharedNamespace();
        arch.relationships = [arch.relationships[1], arch.relationships[0], ...arch.relationships.slice(2)];
        const { out } = roundTrip(arch);
        expect(containment(out).map(([id]) => id)).toEqual(['r2', 'r1', 'r3']);
    });

    it('draws each node once past the copy limit and still keeps every membership', () => {
        // Each level has two containers that are both in both containers of the level above
        const levels = 12;
        const ids = Array.from({ length: levels }, (_, k) => [`l${k}a`, `l${k}b`]);
        const arch: CalmArchitecture = {
            nodes: ids.flat().map(node),
            relationships: ids.slice(1).flatMap(([a, b], k) => [
                deployedIn(`r${k}a`, ids[k][0], [a, b]),
                deployedIn(`r${k}b`, ids[k][1], [a, b]),
            ]),
        };
        const { parsed, out } = roundTrip(arch);
        expect(parsed.nodes).toHaveLength(levels * 2);
        expect(parsed.nodes.find((n) => n.id === 'l11a')?.parentId).toBe('l10b');
        expect(containment(out)).toEqual(arch.relationships.map((r) => [r['unique-id'], (r['relationship-type'] as any)['deployed-in']]));
    });

    it.each([
        ['a container that is not a node', [node('x')], [deployedIn('r1', 'ghost', ['x'])]],
        ['a containment cycle', [node('a'), node('b')], [deployedIn('r1', 'a', ['b']), deployedIn('r2', 'b', ['a'])]],
        ['a node listed as its own container', [node('c'), node('x')], [deployedIn('r1', 'c', ['c', 'x'])]],
        ['a node in a container and in a container inside it', [node('cluster'), node('ns'), node('svc')],
            [deployedIn('r1', 'cluster', ['ns', 'svc']), deployedIn('r2', 'ns', ['svc'])]],
    ])('writes back %s unchanged', (_name, nodes, relationships) => {
        const arch: CalmArchitecture = { nodes, relationships };
        const { out } = roundTrip(arch);
        expect(out.relationships).toEqual(relationships);
    });

    it('keeps each containment relationship, so the same drawing keeps the CALM id after a reload', () => {
        const arch: CalmArchitecture = {
            nodes: [node('c1'), node('c2'), node('a'), node('x')],
            relationships: [
                { ...deployedIn('r1', 'c1', ['a']), description: 'kept' },
                deployedIn('r2', 'c2', ['x']),
                deployedIn('r3', 'c1', ['x']),
            ],
        };
        const { out } = roundTrip(arch);
        expect(out.relationships).toEqual(arch.relationships);
        expect(parseCALMData(out).nodes.find((n) => n.id === 'x')?.parentId).toBe('c1');
    });

    it('writes the layout in file order', () => {
        const arch: CalmArchitecture = {
            nodes: [node('web'), node('k8s'), node('api'), node('db'), node('user')],
            relationships: [deployedIn('r1', 'k8s', ['api', 'db'])],
        };
        const { out } = roundTrip(arch);
        expect(Object.keys((out.metadata as any)._layout)).toEqual(['web', 'k8s', 'api', 'db', 'user']);
    });

    it('keeps the position of a drawing that takes the CALM id when another drawing of it goes', () => {
        const { parsed } = roundTrip(sharedNamespace());
        const moved = parsed.nodes.map((n) => (n.id === 'ns__in__cluster-a' ? { ...n, position: { x: 11, y: 22 } } : n));
        const remaining = moved.filter((n) => n.id !== 'ns' && n.parentId !== 'ns');
        const out = flowToCalm(remaining, []);
        expect(relayoutByPath(out, remaining).ns).toMatchObject({ x: 11, y: 22 });
    });

    it('drops a hidden membership when its container is deleted', () => {
        setLastParsedArch({
            nodes: [node('a'), node('x'), node('gone')],
            relationships: [deployedIn('r1', 'a', ['x']), deployedIn('r2', 'gone', ['x'])],
        });
        const nodes: Node[] = [
            { id: 'a', type: 'container', position: { x: 0, y: 0 }, data: { calmId: 'a' } },
            { id: 'x', position: { x: 0, y: 0 }, parentId: 'a', data: { calmId: 'x', otherParents: ['gone'] } },
        ];
        const out = flowToCalm(nodes, []);
        expect(containment(out)).toEqual([['r1', { container: 'a', nodes: ['x'] }]]);
    });

    it('drops a relationship that an edit leaves empty when its container has another one', () => {
        const arch: CalmArchitecture = {
            nodes: [node('c1'), node('a'), node('x')],
            relationships: [deployedIn('r1', 'c1', ['a']), deployedIn('r3', 'c1', ['x'])],
        };
        const { parsed } = roundTrip(arch);
        const out = flowToCalm(parsed.nodes.filter((n) => n.id !== 'x'), parsed.edges);
        expect(containment(out)).toEqual([['r1', { container: 'c1', nodes: ['a'] }]]);
    });

    it('drops a relationship that an edit leaves empty when its container is not a node', () => {
        const arch: CalmArchitecture = { nodes: [node('x'), node('y')], relationships: [deployedIn('r1', 'ghost', ['x'])] };
        const { parsed } = roundTrip(arch);
        const out = flowToCalm(parsed.nodes.filter((n) => n.id !== 'x'), parsed.edges);
        expect(containment(out)).toEqual([]);
    });

    it('gives a containment relationship with no unique-id the id main gave it', () => {
        const { 'unique-id': _, ...noId } = deployedIn('r1', 'c1', ['a']);
        const { out } = roundTrip({ nodes: [node('c1'), node('a')], relationships: [noId] });
        expect(containment(out)).toEqual([['containment-c1', { container: 'c1', nodes: ['a'] }]]);
    });

    it('keeps every membership of a cycle of three, in either relationship order', () => {
        const rels = [deployedIn('r1', 'a', ['b']), deployedIn('r2', 'b', ['c']), deployedIn('r3', 'c', ['a'])];
        for (const relationships of [rels, [...rels].reverse()]) {
            const { out } = roundTrip({ nodes: [node('a'), node('b'), node('c')], relationships });
            expect(containment(out).sort()).toEqual([
                ['r1', { container: 'a', nodes: ['b'] }],
                ['r2', { container: 'b', nodes: ['c'] }],
                ['r3', { container: 'c', nodes: ['a'] }],
            ]);
        }
    });

    it('writes a node once when two nodes share a unique-id', () => {
        const { out } = roundTrip({ nodes: [node('a'), { ...node('a'), name: 'second' }], relationships: [] });
        expect(out.nodes.map((n) => [n['unique-id'], n.name])).toEqual([['a', 'a']]);
    });

    it('drops a membership when its copy is removed', () => {
        const { parsed } = roundTrip(sharedNamespace());
        const nodes = parsed.nodes.filter((n) => !n.id.endsWith('__in__cluster-a'));
        const out = flowToCalm(nodes, parsed.edges);
        expect(containment(out)).toEqual([
            ['r1', { container: 'cluster-a', nodes: [] }],
            ['r2', { container: 'cluster-b', nodes: ['ns'] }],
            ['r3', { container: 'ns', nodes: ['svc'] }],
        ]);
    });
});

