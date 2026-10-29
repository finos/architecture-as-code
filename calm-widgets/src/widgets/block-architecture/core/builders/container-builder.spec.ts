import { describe, it, expect, afterEach } from 'vitest';
import { pruneEmptyContainers, buildContainerForest } from './container-builder';
import { VMFactoryProvider } from '../factories/factory-provider';
import {
    CalmNodeCanonicalModel
} from '@finos/calm-models/canonical';
import { VMLeafNode, VMContainer } from '../../types';
import { VMNodeFactory } from '../factories/vm-factory-interfaces';

describe('container-builder', () => {
    afterEach(() => {
        VMFactoryProvider.resetToDefaults();
    });

    it('pruneEmptyContainers removes empty containers recursively', () => {
        const input: VMContainer[] = [
            { id: 'c1', label: 'C1', nodes: [], containers: [{ id: 'c2', label: 'C2', nodes: [], containers: [] }] },
            { id: 'c3', label: 'C3', nodes: [{ id: 'n1', label: 'N1' }], containers: [] }
        ];
        const out = pruneEmptyContainers(input);
        expect(out.find(c => c.id === 'c1')).toBeUndefined();
        expect(out.find(c => c.id === 'c3')).toBeDefined();
    });

    it('buildContainerForest assigns nodes to containers and returns loose nodes', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel, _renderInterfaces: boolean) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'n1', name: 'One',        'node-type': 'service',  description: '' },
            { 'unique-id': 'c1', name: 'Container',  'node-type': 'system',   description: '' },
            { 'unique-id': 'n2', name: 'Two',        'node-type': 'database', description: '' }
        ];
        const parentsOf = new Map<string, string[]>([['n1', ['c1']]]);
        const containerIds = new Set<string>(['c1']);

        const { containers, attachments, looseNodes } =
            buildContainerForest(nodes, parentsOf, containerIds, false);

        expect(containers).toHaveLength(1);
        expect(containers[0].id).toBe('c1');
        expect(containers[0].nodes.find((n: VMLeafNode) => n.id === 'n1')).toBeDefined();

        expect(looseNodes.find((n: VMLeafNode) => n.id === 'n2')).toBeDefined();
        expect(attachments).toHaveLength(0);
    });

    it('nodes are loose if their parent container exists but is NOT in the render set', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'n1', name: 'Child',   'node-type': 'service', description: '' },
            { 'unique-id': 'c1', name: 'HiddenC', 'node-type': 'system',  description: '' }
        ];
        // n1’s parent is c1, but c1 won’t be rendered
        const parentsOf = new Map<string, string[]>([['n1', ['c1']]]);
        const containerIds = new Set<string>(); // empty — nothing rendered

        const { containers, looseNodes, attachments } =
            buildContainerForest(nodes, parentsOf, containerIds, false);

        expect(containers).toHaveLength(0);               // no containers rendered
        expect(looseNodes.map(n => n.id)).toEqual(['n1', 'c1']); // both are loose
        expect(attachments).toHaveLength(0);
    });

    it('passes activeInterfaceIds to the node factory when provided', () => {
        const capturedActiveIds: Array<Set<string> | undefined> = [];
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel, _renderInterfaces: boolean, activeInterfaceIds?: Set<string>) => {
                capturedActiveIds.push(activeInterfaceIds);
                return { node: { id: node['unique-id'], label: node.name || node['unique-id'] }, attachments: [] };
            }
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'svcA', name: 'A', 'node-type': 'service', description: '' },
            { 'unique-id': 'svcB', name: 'B', 'node-type': 'service', description: '' },
        ];
        const activeInterfaceIds = new Set<string>(['payment-api', 'fraud-check-api']);

        buildContainerForest(nodes, new Map(), new Set(), true, activeInterfaceIds);

        expect(capturedActiveIds).toHaveLength(2);
        expect(capturedActiveIds[0]).toBe(activeInterfaceIds);
        expect(capturedActiveIds[1]).toBe(activeInterfaceIds);
    });

    it('creates container → container nesting when both are rendered', () => {
        const fakeNodeFactory: VMNodeFactory = {
            createLeafNode: (node: CalmNodeCanonicalModel) => ({
                node: { id: node['unique-id'], label: node.name || node['unique-id'] },
                attachments: []
            })
        };
        VMFactoryProvider.setFactories(fakeNodeFactory, undefined);

        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'cRoot', name: 'Root',     'node-type': 'system',  description: '' },
            { 'unique-id': 'cChild','name': 'Child',  'node-type': 'system',  description: '' },
            { 'unique-id': 'leaf',  name: 'Leaf',     'node-type': 'service', description: '' }
        ];
        // cChild is child of cRoot; leaf is child of cChild
        const parentsOf = new Map<string, string[]>([
            ['cChild', ['cRoot']],
            ['leaf',   ['cChild']]
        ]);
        const containerIds = new Set<string>(['cRoot', 'cChild']); // both rendered

        const { containers, looseNodes } =
            buildContainerForest(nodes, parentsOf, containerIds, false);

        expect(containers).toHaveLength(1);
        expect(containers[0].id).toBe('cRoot');

        const nested = containers[0].containers.find(c => c.id === 'cChild');
        expect(nested).toBeDefined();

        expect(nested!.nodes.find(n => n.id === 'leaf')).toBeDefined();

        expect(looseNodes).toHaveLength(0);
    });

    it('lists interface attachments in the order of the input nodes', () => {
        const iface = [{ 'unique-id': 'api', name: 'API' }];
        const nodes: CalmNodeCanonicalModel[] = [
            { 'unique-id': 'loose', name: 'Loose', 'node-type': 'service', description: '', interfaces: iface },
            { 'unique-id': 'c1', name: 'C1', 'node-type': 'system', description: '' },
            { 'unique-id': 'inner', name: 'Inner', 'node-type': 'service', description: '', interfaces: iface },
        ];

        const { attachments } = buildContainerForest(nodes, new Map([['inner', ['c1']]]), new Set(['c1']), true);

        expect(attachments.map(a => a.from)).toEqual(['loose', 'inner']);
    });

    describe('nodes with several parents', () => {
        const node = (id: string, extra: Partial<CalmNodeCanonicalModel> = {}): CalmNodeCanonicalModel =>
            ({ 'unique-id': id, name: id, 'node-type': 'system', description: '', ...extra });

        it('draws a leaf node once in each rendered parent', () => {
            const nodes = [node('cluster-a'), node('cluster-b'), node('ns')];
            const parentsOf = new Map([['ns', ['cluster-a', 'cluster-b']]]);

            const { containers, looseNodes, instancesOf } =
                buildContainerForest(nodes, parentsOf, new Set(['cluster-a', 'cluster-b']), false);

            expect(looseNodes).toEqual([]);
            const a = containers.find(c => c.id === 'cluster-a')!;
            const b = containers.find(c => c.id === 'cluster-b')!;
            expect(a.nodes).toEqual([expect.objectContaining({ id: 'ns__in__cluster-a', sourceId: 'ns', label: 'ns' })]);
            expect(b.nodes).toEqual([expect.objectContaining({ id: 'ns__in__cluster-b', sourceId: 'ns', label: 'ns' })]);
            expect(instancesOf.get('ns')).toEqual(['ns__in__cluster-a', 'ns__in__cluster-b']);
        });

        it('copies a shared container with everything nested in it', () => {
            const nodes = [node('cluster-a'), node('cluster-b'), node('ns'), node('svc', { 'node-type': 'service' })];
            const parentsOf = new Map([
                ['ns', ['cluster-a', 'cluster-b']],
                ['svc', ['ns']],
            ]);

            const { containers, instancesOf, ancestorsOf } =
                buildContainerForest(nodes, parentsOf, new Set(['cluster-a', 'cluster-b', 'ns']), false);

            expect(containers.map(c => c.id)).toEqual(['cluster-a', 'cluster-b']);
            const nsInA = containers[0].containers[0];
            expect(nsInA).toEqual(expect.objectContaining({ id: 'ns__in__cluster-a', sourceId: 'ns' }));
            expect(nsInA.nodes.map(n => n.id)).toEqual(['svc__in__ns__in__cluster-a']);
            expect(containers[1].containers[0].nodes.map(n => n.id)).toEqual(['svc__in__ns__in__cluster-b']);
            expect(instancesOf.get('svc')).toEqual(['svc__in__ns__in__cluster-a', 'svc__in__ns__in__cluster-b']);
            expect(ancestorsOf.get('svc__in__ns__in__cluster-b')).toEqual(['cluster-b', 'ns__in__cluster-b']);
        });

        it('keeps original ids for nodes drawn once', () => {
            const nodes = [node('cluster-a'), node('svc')];
            const parentsOf = new Map([['svc', ['cluster-a']]]);

            const { containers, instancesOf } =
                buildContainerForest(nodes, parentsOf, new Set(['cluster-a']), false);

            expect(containers[0].sourceId).toBeUndefined();
            expect(containers[0].nodes[0].id).toBe('svc');
            expect(containers[0].nodes[0].sourceId).toBeUndefined();
            expect(instancesOf.get('svc')).toEqual(['svc']);
        });

        it('draws a node only in the parents that are rendered', () => {
            const nodes = [node('cluster-a'), node('cluster-b'), node('ns')];
            const parentsOf = new Map([['ns', ['cluster-a', 'cluster-b']]]);

            const { containers } =
                buildContainerForest(nodes, parentsOf, new Set(['cluster-b']), false);

            expect(containers).toHaveLength(1);
            expect(containers[0].nodes.map(n => n.id)).toEqual(['ns']);
        });

        it('does not give a copy the id of a real node', () => {
            const nodes = [node('a'), node('b'), node('x'), node('x__in__a')];
            const parentsOf = new Map([
                ['x', ['a', 'b']],
                ['x__in__a', ['a']],
            ]);

            const { containers, instancesOf } =
                buildContainerForest(nodes, parentsOf, new Set(['a', 'b']), false);

            const ids = containers.flatMap(c => c.nodes.map(n => n.id));
            expect(new Set(ids).size).toBe(ids.length);
            expect(containers[0].nodes.find(n => n.label === 'x__in__a')?.id).toBe('x__in__a');
            expect(instancesOf.get('x')).not.toContain('x__in__a');
        });

        it('draws a container whose parent is not rendered as a root', () => {
            const nodes = [node('ns'), node('svc')];
            const parentsOf = new Map([
                ['ns', ['cluster']],
                ['svc', ['ns']],
            ]);

            const { containers, looseNodes } =
                buildContainerForest(nodes, parentsOf, new Set(['ns']), false);

            expect(looseNodes).toEqual([]);
            expect(containers.map(c => c.id)).toEqual(['ns']);
            expect(containers[0].nodes.map(n => n.id)).toEqual(['svc']);
        });

        it('draws each node once when copies would exceed the limit', () => {
            // Each level has two containers that are both in both containers of the level above
            const levels = 12;
            const ids = Array.from({ length: levels }, (_, k) => [`l${k}a`, `l${k}b`]);
            const parentsOf = new Map(ids.slice(1).flatMap(([a, b], k) => [[a, ids[k]], [b, ids[k]]] as [string, string[]][]));

            const { containers, instancesOf } =
                buildContainerForest(ids.flat().map(id => node(id)), parentsOf, new Set(ids.flat()), false);

            const count = (cs: VMContainer[]): number => cs.reduce((sum, c) => sum + 1 + count(c.containers), 0);
            expect(count(containers)).toBe(levels * 2);
            expect(instancesOf.get('l11a')).toEqual(['l11a']);
        });

        it('gives each copy its own interfaces and attachments', () => {
            const nodes = [
                node('cluster-a'),
                node('cluster-b'),
                node('svc', { interfaces: [{ 'unique-id': 'http', name: 'HTTP' }] }),
            ];
            const parentsOf = new Map([['svc', ['cluster-a', 'cluster-b']]]);

            const { containers, attachments, instancesOf } =
                buildContainerForest(nodes, parentsOf, new Set(['cluster-a', 'cluster-b']), true);

            expect(containers[0].nodes[0].interfaces).toEqual([
                { id: 'svc__in__cluster-a__iface__http', sourceId: 'svc__iface__http', label: '◻ HTTP' },
            ]);
            expect(attachments).toEqual([
                { from: 'svc__in__cluster-a', to: 'svc__in__cluster-a__iface__http' },
                { from: 'svc__in__cluster-b', to: 'svc__in__cluster-b__iface__http' },
            ]);
            expect(instancesOf.get('svc__iface__http')).toEqual([
                'svc__in__cluster-a__iface__http',
                'svc__in__cluster-b__iface__http',
            ]);
        });
    });
});
