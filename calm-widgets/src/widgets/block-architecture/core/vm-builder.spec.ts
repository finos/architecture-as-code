import { describe, it, expect } from 'vitest';
import { buildBlockArchVM, BlockArchVMBuilder } from './vm-builder';
import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../types';

const baseOpts = (over: Partial<NormalizedOptions> = {}): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false,
    theme: 'light',
    layoutEngine: 'elk',
    ...over,
});

describe('vm-builder', () => {
    it('buildBlockArchVM returns empty vm for empty context', () => {
        const context: CalmCoreCanonicalModel = { nodes: [], relationships: [] };
        const opts = baseOpts();
        const vm = buildBlockArchVM(context, opts);
        expect(vm.containers).toEqual([]);
        expect(vm.edges).toEqual([]);
        expect(vm.looseNodes).toEqual([]);
    });

    it('BlockArchVMBuilder enforces call order', () => {
        const context: CalmCoreCanonicalModel = { nodes: [], relationships: [] };
        const opts = baseOpts();
        const builder = new BlockArchVMBuilder(context, opts);

        expect(() => builder.resolveVisibility()).toThrowError(
            'Must call analyzeRelationships() first'
        );
        builder.analyzeRelationships();

        expect(() => builder.buildContainers()).toThrowError(
            'Must call resolveVisibility() first'
        );
    });

    it('builds simple container with node inside', () => {
        const context: CalmCoreCanonicalModel = {
            nodes: [
                { 'unique-id': 'c1', 'node-type': 'system', name: 'Container1', description: '' },
                { 'unique-id': 'n1', 'node-type': 'service', name: 'Service1', description: '' },
            ],
            relationships: [
                {
                    'unique-id': 'r1',
                    'relationship-type': { 'composed-of': { container: 'c1', nodes: ['n1'] } },
                },
            ],
        };

        const opts = baseOpts();
        const vm = buildBlockArchVM(context, opts);

        expect(vm.containers.length).toBe(1);
        expect(vm.containers[0].id).toBe('c1');
        expect(vm.containers[0].nodes.some((n) => n.id === 'n1')).toBe(true);
        expect(vm.edges.length).toBe(0);
    });

    it('builds connects edge between two nodes', () => {
        const context: CalmCoreCanonicalModel = {
            nodes: [
                { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' },
                { 'unique-id': 'b', 'node-type': 'database', name: 'B', description: '' },
            ],
            relationships: [
                {
                    'unique-id': 'r1',
                    'relationship-type': {
                        connects: {
                            source: { node: 'a', interfaces: ['api'] },
                            destination: { node: 'b', interfaces: ['jdbc'] },
                        },
                    },
                    description: 'A to B',
                },
            ],
        };

        const opts = baseOpts({ renderInterfaces: true });
        const vm = buildBlockArchVM(context, opts);

        expect(vm.edges.length).toBe(1);
        expect(vm.edges[0].id).toBe('r1');
        expect(vm.edges[0].label).toBe('A to B');
        // check that iface IDs are used when renderInterfaces = true
        expect(vm.edges[0].source).toContain('a__iface__');
        expect(vm.edges[0].target).toContain('b__iface__');
    });

    it('merges highlight and focus nodes into highlightNodeIds', () => {
        const context: CalmCoreCanonicalModel = {
            nodes: [{ 'unique-id': 'x', 'node-type': 'actor', name: 'X', description: '' }],
            relationships: [],
        };
        const opts = baseOpts({ focusNodes: ['x'], highlightNodes: ['y'] });
        const vm = buildBlockArchVM(context, opts);
        expect(vm.highlightNodeIds).toEqual(expect.arrayContaining(['x', 'y']));
    });

    it('includes warnings from visibility', () => {
        const context: CalmCoreCanonicalModel = {
            nodes: [
                { 'unique-id': 'n1', 'node-type': 'service', name: 'N1', description: '' },
                { 'unique-id': 'c1', 'node-type': 'system', name: 'C1', description: '' },
            ],
            relationships: [
                {
                    'unique-id': 'r1',
                    'relationship-type': { 'composed-of': { container: 'c1', nodes: ['n1', 'n1'] } },
                },
            ],
        };
        const vm = buildBlockArchVM(context, baseOpts());
        expect(Array.isArray(vm.warnings)).toBe(true);
    });

    it('draws a focused node in its container when the container parent is not drawn', () => {
        const context: CalmCoreCanonicalModel = {
            nodes: [
                { 'unique-id': 'N', 'node-type': 'service', name: 'N', description: '' },
                { 'unique-id': 'C', 'node-type': 'system', name: 'C', description: '' },
                { 'unique-id': 'D', 'node-type': 'system', name: 'D', description: '' },
            ],
            relationships: [
                { 'unique-id': 'r1', 'relationship-type': { 'composed-of': { container: 'C', nodes: ['N'] } } },
                { 'unique-id': 'r2', 'relationship-type': { 'deployed-in': { container: 'D', nodes: ['C'] } } },
            ],
        };
        const vm = buildBlockArchVM(context, baseOpts({ focusNodes: ['N'], includeContainers: 'parents' }));
        expect(vm.containers.map(c => [c.id, c.nodes.map(n => n.id)])).toEqual([['C', ['N']]]);
    });

    describe('nodes shared between clusters', () => {
        const node = (id: string, type = 'system') => ({ 'unique-id': id, 'node-type': type, name: id, description: '' });
        const deployedIn = (id: string, container: string, nodes: string[]) =>
            ({ 'unique-id': id, 'relationship-type': { 'deployed-in': { container, nodes } } });
        const connects = (id: string, source: string, destination: string) =>
            ({ 'unique-id': id, 'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } } });

        const sharedNamespaces = (extraNodes: ReturnType<typeof node>[], extraRels: CalmRelationshipCanonicalModel[]): CalmCoreCanonicalModel => ({
            nodes: [
                node('cluster-a'), node('cluster-b'), node('ns-orders'), node('ns-payments'),
                node('orders', 'service'), node('payments', 'service'),
                ...extraNodes,
            ],
            relationships: [
                deployedIn('d1', 'cluster-a', ['ns-orders', 'ns-payments']),
                deployedIn('d2', 'cluster-b', ['ns-orders', 'ns-payments']),
                deployedIn('d3', 'ns-orders', ['orders']),
                deployedIn('d4', 'ns-payments', ['payments']),
                ...extraRels,
            ],
        });

        it('draws a shared namespace and its services in every cluster', () => {
            const vm = buildBlockArchVM(sharedNamespaces([], []), baseOpts());

            expect(vm.containers.map(c => c.id)).toEqual(['cluster-a', 'cluster-b']);
            for (const cluster of ['cluster-a', 'cluster-b']) {
                const c = vm.containers.find(x => x.id === cluster)!;
                expect(c.containers.map(x => x.id)).toEqual([`ns-orders__in__${cluster}`, `ns-payments__in__${cluster}`]);
                expect(c.containers[1].nodes.map(n => n.id)).toEqual([`payments__in__ns-payments__in__${cluster}`]);
            }
            expect(vm.looseNodes).toEqual([]);
            expect(vm.warnings).toEqual([]);
        });

        it('connects copies of shared nodes inside the same cluster only', () => {
            const vm = buildBlockArchVM(sharedNamespaces([], [connects('c1', 'orders', 'payments')]), baseOpts());

            expect(vm.edges.map(e => [e.source, e.target])).toEqual([
                ['orders__in__ns-orders__in__cluster-a', 'payments__in__ns-payments__in__cluster-a'],
                ['orders__in__ns-orders__in__cluster-b', 'payments__in__ns-payments__in__cluster-b'],
            ]);
            expect(new Set(vm.edges.map(e => e.id)).size).toBe(2);
        });

        it('connects a node drawn once to every copy of a shared node', () => {
            const vm = buildBlockArchVM(
                sharedNamespaces([node('client', 'actor')], [connects('c1', 'client', 'payments')]),
                baseOpts()
            );

            expect(vm.edges.map(e => [e.source, e.target])).toEqual([
                ['client', 'payments__in__ns-payments__in__cluster-a'],
                ['client', 'payments__in__ns-payments__in__cluster-b'],
            ]);
        });

        it('requires containers before edges, because edges point at drawn copies', () => {
            const builder = new BlockArchVMBuilder(sharedNamespaces([], []), baseOpts());
            builder.analyzeRelationships().resolveVisibility();
            expect(() => builder.buildEdges()).toThrowError('Must call buildContainers() first');
        });

        it('connects edges to the interfaces of each copy', () => {
            const context = sharedNamespaces([], [{
                'unique-id': 'c1',
                'relationship-type': { connects: { source: { node: 'orders' }, destination: { node: 'payments', interfaces: ['api'] } } },
            }]);
            context.nodes!.find(n => n['unique-id'] === 'payments')!.interfaces = [{ 'unique-id': 'api', name: 'API' }];

            const vm = buildBlockArchVM(context, baseOpts({ renderInterfaces: true }));

            expect(vm.edges.map(e => [e.source, e.target])).toEqual([
                ['orders__in__ns-orders__in__cluster-a', 'payments__in__ns-payments__in__cluster-a__iface__api'],
                ['orders__in__ns-orders__in__cluster-b', 'payments__in__ns-payments__in__cluster-b__iface__api'],
            ]);
        });

        it('connects only the copy inside a container to that container', () => {
            const vm = buildBlockArchVM(sharedNamespaces([], [connects('c1', 'orders', 'cluster-b')]), baseOpts());

            expect(vm.edges.map(e => [e.source, e.target])).toEqual([
                ['orders__in__ns-orders__in__cluster-b', 'cluster-b'],
            ]);
        });

        it('points edges at the plain id when every copy is pruned', () => {
            const composedOf = (id: string, container: string, nodes: string[]) =>
                ({ 'unique-id': id, 'relationship-type': { 'composed-of': { container, nodes } } });
            const context: CalmCoreCanonicalModel = {
                nodes: [node('c1'), node('c2'), node('ns'), node('m'), node('x')],
                relationships: [
                    composedOf('r1', 'ns', ['m']),
                    deployedIn('r2', 'c1', ['ns']),
                    deployedIn('r3', 'c2', ['ns']),
                    connects('r4', 'x', 'ns'),
                ],
            };

            const vm = buildBlockArchVM(context, baseOpts({ focusNodes: ['x', 'ns'], includeChildren: 'none' }));

            expect(vm.edges.map(e => [e.source, e.target])).toEqual([['x', 'ns']]);
        });

        it('draws a node once when it is listed in both its cluster and its namespace', () => {
            const context: CalmCoreCanonicalModel = {
                nodes: [node('cluster'), node('ns'), node('svc', 'service'), node('db', 'database')],
                relationships: [
                    deployedIn('d1', 'cluster', ['ns', 'svc']),
                    deployedIn('d2', 'ns', ['svc', 'db']),
                    connects('c1', 'svc', 'db'),
                ],
            };

            const vm = buildBlockArchVM(context, baseOpts());

            expect(vm.containers[0].nodes).toEqual([]);
            expect(vm.containers[0].containers[0].nodes.map(n => n.id).sort()).toEqual(['db', 'svc']);
            expect(vm.edges.map(e => [e.source, e.target])).toEqual([['svc', 'db']]);
        });

        it('keeps sibling containers with the same label in the order of their parent relationships', () => {
            const composedOf = (id: string, container: string, nodes: string[]) =>
                ({ 'unique-id': id, 'relationship-type': { 'composed-of': { container, nodes } } });
            const context: CalmCoreCanonicalModel = {
                nodes: [node('P'), { ...node('X'), name: 'ns' }, { ...node('Y'), name: 'ns' }, node('a'), node('b')],
                relationships: [composedOf('r1', 'P', ['X', 'Y']), composedOf('r2', 'Y', ['b']), composedOf('r3', 'X', ['a'])],
            };

            const vm = buildBlockArchVM(context, baseOpts());

            expect(vm.containers[0].containers.map(c => c.id)).toEqual(['X', 'Y']);
        });

        it('highlights every copy of a highlighted node', () => {
            const vm = buildBlockArchVM(sharedNamespaces([], []), baseOpts({ highlightNodes: ['payments'] }));

            expect(vm.highlightNodeIds).toEqual([
                'payments__in__ns-payments__in__cluster-a',
                'payments__in__ns-payments__in__cluster-b',
            ]);
        });
    });
});
