import { describe, it, expect, afterEach } from 'vitest';
import { buildInterfaceNameMap, buildEdges, expandEdgesToInstances } from './edge-builder';
import { VMFactoryProvider } from '../factories/factory-provider';
import {
    CalmNodeCanonicalModel,
    CalmRelationshipCanonicalModel
} from '@finos/calm-models/canonical';
import { EdgeConfig, VMEdgeFactory } from '../factories/vm-factory-interfaces';
import { VMEdge } from '../../types';

class CapturingEdgeFactory implements VMEdgeFactory {
    public calls: Array<{ rel: CalmRelationshipCanonicalModel; cfg: EdgeConfig }> = [];
    constructor(private readonly result: VMEdge[]) {}
    createEdge(rel: CalmRelationshipCanonicalModel, cfg: EdgeConfig): VMEdge[] {
        this.calls.push({ rel, cfg });
        return this.result.map(e => ({ ...e }));
    }
}

describe('edge-builder', () => {
    afterEach(() => {
        VMFactoryProvider.resetToDefaults();
    });

    it('buildInterfaceNameMap builds map from node interfaces and falls back to unique-id', () => {
        const nodes: CalmNodeCanonicalModel[] = [
            {
                'unique-id': 'n1',
                'node-type': 'service',
                name: 'N1',
                description: '',
                interfaces: [{ 'unique-id': 'i1', name: 'IF1' }, { 'unique-id': 'i2' }] // i2 has no name
            },
            {
                'unique-id': 'n2',
                'node-type': 'database',
                name: 'N2',
                description: ''
            }
        ];

        const map = buildInterfaceNameMap(nodes);

        expect(map.has('n1')).toBe(true);
        expect(map.get('n1')!.get('i1')).toBe('IF1');
        expect(map.get('n1')!.get('i2')).toBe('i2'); // fallback to unique-id
        expect(map.has('n2')).toBe(false); // no interfaces -> not included
    });

    it('buildEdges delegates to edge factory and forwards full config', () => {
        const expectedEdges: VMEdge[] = [{ id: 'r1', source: 'a', target: 'b' }];

        const fake = new CapturingEdgeFactory(expectedEdges);
        VMFactoryProvider.setFactories(undefined, fake);

        const rels: CalmRelationshipCanonicalModel[] = [
            { 'unique-id': 'r1', 'relationship-type': { interacts: { actor: 'u', nodes: [] } } }
        ];

        const ifaceNames = new Map<string, Map<string, string>>();
        const nodesById = new Map<string, CalmNodeCanonicalModel>([
            ['a', { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: '' }],
            ['b', { 'unique-id': 'b', 'node-type': 'database', name: 'B', description: '' }]
        ]);

        const out = buildEdges(rels, false, 'description', false, ifaceNames, nodesById);

        expect(out).toEqual(expectedEdges);

        expect(fake.calls).toHaveLength(1);
        expect(fake.calls[0].rel['unique-id']).toBe('r1');

        const cfg = fake.calls[0].cfg;
        expect(cfg.renderInterfaces).toBe(false);
        expect(cfg.edgeLabelMode).toBe('description');
        expect(cfg.collapseRelationships).toBe(false);
        expect(cfg.ifaceNames).toBe(ifaceNames);
        expect(cfg.nodesById).toBe(nodesById);
    });

    it('collapses multiple relationships between same source-target pairs when flag is enabled', () => {
        const example = {
            calls: [] as Array<{ rel: CalmRelationshipCanonicalModel; cfg: EdgeConfig }>,
            createEdge(rel: CalmRelationshipCanonicalModel, cfg: EdgeConfig): VMEdge[] {
                this.calls.push({ rel, cfg });
                if (rel['unique-id'] === 'r1') {
                    return [{ id: 'r1', source: 'a', target: 'b', label: 'Connection 1' }];
                } else if (rel['unique-id'] === 'r2') {
                    return [{ id: 'r2', source: 'a', target: 'b', label: 'Connection 2' }];
                } else if (rel['unique-id'] === 'r3') {
                    return [{ id: 'r3', source: 'c', target: 'd', label: 'Other connection' }];
                }
                return [];
            }
        };

        VMFactoryProvider.setFactories(undefined, example as VMEdgeFactory);

        const rels: CalmRelationshipCanonicalModel[] = [
            { 'unique-id': 'r1', 'relationship-type': { interacts: { actor: 'u', nodes: [] } }, description: 'Connection 1' },
            { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'u', nodes: [] } }, description: 'Connection 2' },
            { 'unique-id': 'r3', 'relationship-type': { interacts: { actor: 'u', nodes: [] } }, description: 'Other connection' }
        ];

        const ifaceNames = new Map<string, Map<string, string>>();
        const nodesById = new Map<string, CalmNodeCanonicalModel>();

        // Test with collapsing enabled
        const collapsedOut = buildEdges(rels, false, 'description', true, ifaceNames, nodesById);

        expect(collapsedOut).toHaveLength(2); // Two unique source-target pairs

        // Find the collapsed edge (a->b)
        const collapsedEdge = collapsedOut.find(e => e.source === 'a' && e.target === 'b');
        expect(collapsedEdge).toBeDefined();
        expect(collapsedEdge!.id).toBe('r1|r2'); // IDs joined with |
        expect(collapsedEdge!.label).toBe('Connection 1, Connection 2'); // Labels combined

        // Find the non-collapsed edge (c->d)
        const nonCollapsedEdge = collapsedOut.find(e => e.source === 'c' && e.target === 'd');
        expect(nonCollapsedEdge).toBeDefined();
        expect(nonCollapsedEdge!.id).toBe('r3');
        expect(nonCollapsedEdge!.label).toBe('Other connection');

        // Test without collapsing (should return 3 separate edges)
        const normalOut = buildEdges(rels, false, 'description', false, ifaceNames, nodesById);
        expect(normalOut).toHaveLength(3); // All original edges
    });

    it('merges collapsed edge labels from unique-ids when edgeLabelMode="unique-id"', () => {
        const example = {
            createEdge(rel: CalmRelationshipCanonicalModel): VMEdge[] {
                if (rel['unique-id'] === 'r1') {
                    return [{ id: 'r1', source: 'a', target: 'b' }];
                } else if (rel['unique-id'] === 'r2') {
                    return [{ id: 'r2', source: 'a', target: 'b' }];
                }
                return [];
            }
        };

        VMFactoryProvider.setFactories(undefined, example as VMEdgeFactory);

        const rels: CalmRelationshipCanonicalModel[] = [
            { 'unique-id': 'r1', 'relationship-type': { interacts: { actor: 'u', nodes: [] } } },
            { 'unique-id': 'r2', 'relationship-type': { interacts: { actor: 'u', nodes: [] } } }
        ];

        const collapsedOut = buildEdges(rels, false, 'unique-id', true, new Map(), new Map());

        const collapsedEdge = collapsedOut.find(e => e.source === 'a' && e.target === 'b');
        expect(collapsedEdge).toBeDefined();
        expect(collapsedEdge!.id).toBe('r1|r2');
        expect(collapsedEdge!.label).toBe('r1, r2');
    });

    describe('expandEdgesToInstances', () => {
        const edge: VMEdge = { id: 'r1', source: 'svc', target: 'db', label: 'reads' };

        it('keeps an edge unchanged when neither end has copies', () => {
            expect(expandEdgesToInstances([edge], new Map(), new Map())).toEqual([edge]);
        });

        it('connects every copy of one end to the single other end', () => {
            const instancesOf = new Map([['svc', ['svc__in__A', 'svc__in__B']], ['db', ['db']]]);
            const ancestorsOf = new Map([['svc__in__A', ['A']], ['svc__in__B', ['B']], ['db', ['A']]]);

            expect(expandEdgesToInstances([edge], instancesOf, ancestorsOf)).toEqual([
                { id: 'r1__0', source: 'svc__in__A', target: 'db', label: 'reads' },
                { id: 'r1__1', source: 'svc__in__B', target: 'db', label: 'reads' },
            ]);
        });

        it('connects copies of both ends only where they share the most containers', () => {
            const instancesOf = new Map([['svc', ['svc__in__A', 'svc__in__B']], ['db', ['db__in__A', 'db__in__B']]]);
            const ancestorsOf = new Map([
                ['svc__in__A', ['A']], ['svc__in__B', ['B']],
                ['db__in__A', ['A']], ['db__in__B', ['B']],
            ]);

            expect(expandEdgesToInstances([edge], instancesOf, ancestorsOf).map(e => [e.source, e.target])).toEqual([
                ['svc__in__A', 'db__in__A'],
                ['svc__in__B', 'db__in__B'],
            ]);
        });

        it('connects all copies when no copies share a container', () => {
            const instancesOf = new Map([['svc', ['svc__in__A', 'svc__in__B']], ['db', ['db__in__C', 'db__in__D']]]);
            const ancestorsOf = new Map([
                ['svc__in__A', ['A']], ['svc__in__B', ['B']],
                ['db__in__C', ['C']], ['db__in__D', ['D']],
            ]);

            expect(expandEdgesToInstances([edge], instancesOf, ancestorsOf)).toHaveLength(4);
        });
    });
});
