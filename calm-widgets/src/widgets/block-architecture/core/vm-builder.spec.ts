import { describe, it, expect } from 'vitest';
import { buildBlockArchVM, BlockArchVMBuilder } from './vm-builder';
import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../types';

const baseOpts = (over: Partial<NormalizedOptions> = {}): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    edgeLabels: 'description',
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
});
