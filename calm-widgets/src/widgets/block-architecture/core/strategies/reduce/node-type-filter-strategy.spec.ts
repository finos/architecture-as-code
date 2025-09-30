import { describe, it, expect } from 'vitest';
import { NodeTypeFilterStrategy } from './node-type-filter-strategy';
import { CalmNodeCanonicalModel, CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

describe('NodeTypeFilterStrategy', () => {
    it('filters nodes by node-type (single type)', () => {
        const nodesById = new Map<string, CalmNodeCanonicalModel>([
            ['svc1', { 'unique-id': 'svc1', 'node-type': 'service', name: 'Service A', description: 'API service' }],
            ['db1', { 'unique-id': 'db1', 'node-type': 'database', name: 'User DB', description: 'Primary DB' }],
            ['cache1', { 'unique-id': 'cache1', 'node-type': 'cache', name: 'Redis Cache', description: 'Fast cache' }]
        ]);

        const strat = new NodeTypeFilterStrategy(nodesById);
        const current = new Set(['svc1', 'db1', 'cache1']);
        const context: CalmCoreCanonicalModel = { nodes: Array.from(nodesById.values()), relationships: [] };
        const opts: NormalizedOptions = {
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
            collapseRelationships: false,
            nodeTypes: ['service']
        };

        const res = strat.applyFilter(context, opts, current, []);

        expect(res.visibleNodes.has('svc1')).toBe(true);
        expect(res.visibleNodes.has('db1')).toBe(false);
        expect(res.visibleNodes.has('cache1')).toBe(false);
        expect(res.warnings).toEqual([]);
    });

    it('returns current visible when nodeTypes not provided or empty', () => {
        const nodesById = new Map<string, CalmNodeCanonicalModel>([
            ['svc1', { 'unique-id': 'svc1', 'node-type': 'service', name: 'Service A', description: '' }]
        ]);
        const strat = new NodeTypeFilterStrategy(nodesById);
        const current = new Set(['svc1']);
        const context: CalmCoreCanonicalModel = { nodes: Array.from(nodesById.values()), relationships: [] };

        const optsNoField: NormalizedOptions = {
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
            collapseRelationships: false
            // nodeTypes omitted
        };

        const res1 = strat.applyFilter(context, optsNoField, current, []);
        expect(res1.visibleNodes).toEqual(current);

        const optsEmpty: NormalizedOptions = { ...optsNoField, nodeTypes: [] };
        const res2 = strat.applyFilter(context, optsEmpty, current, []);
        expect(res2.visibleNodes).toEqual(current);
    });

    it('supports multiple node types (OR logic)', () => {
        const nodesById = new Map<string, CalmNodeCanonicalModel>([
            ['svc1', { 'unique-id': 'svc1', 'node-type': 'service', name: 'Service A', description: '' }],
            ['svc2', { 'unique-id': 'svc2', 'node-type': 'service', name: 'Service B', description: '' }],
            ['db1', { 'unique-id': 'db1', 'node-type': 'database', name: 'User DB', description: '' }]
        ]);
        const strat = new NodeTypeFilterStrategy(nodesById);
        const current = new Set(['svc1', 'svc2', 'db1']);
        const context: CalmCoreCanonicalModel = { nodes: Array.from(nodesById.values()), relationships: [] };
        const opts: NormalizedOptions = {
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
            collapseRelationships: false,
            nodeTypes: ['service', 'database']
        };

        const res = strat.applyFilter(context, opts, current, []);
        expect(res.visibleNodes).toEqual(new Set(['svc1', 'svc2', 'db1']));
    });

    it('excludes nodes missing node-type property', () => {
        const nodesById = new Map<string, CalmNodeCanonicalModel>([
            ['svc1', { 'unique-id': 'svc1', 'node-type': 'service', name: 'Service A', description: '' }],
            // node missing node-type
            ['mystery', { 'unique-id': 'mystery', name: 'Unknown', description: '' } as CalmNodeCanonicalModel]
        ]);

        const strat = new NodeTypeFilterStrategy(nodesById);
        const current = new Set(['svc1', 'mystery']);
        const context: CalmCoreCanonicalModel = { nodes: Array.from(nodesById.values()), relationships: [] };
        const opts: NormalizedOptions = {
            includeContainers: 'all',
            includeChildren: 'all',
            edges: 'connected',
            direction: 'both',
            renderInterfaces: false,
            edgeLabels: 'description',
            collapseRelationships: false,
            nodeTypes: ['service']
        };

        const res = strat.applyFilter(context, opts, current, []);
        expect(res.visibleNodes.has('svc1')).toBe(true);
        expect(res.visibleNodes.has('mystery')).toBe(false);
    });
});
