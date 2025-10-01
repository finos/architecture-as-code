import { describe, it, expect } from 'vitest';
import { VisibilityFilterChain, VisibilityFilterStrategy } from './visibility-strategy';
import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../types';

const baseOpts: NormalizedOptions = {
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false
};

const emptyContext: CalmCoreCanonicalModel = { nodes: [], relationships: [] };

describe('visibility-strategy', () => {
    it('applyFilters returns initial visible set when no strategies', () => {
        const chain = new VisibilityFilterChain();
        const init = new Set(['a']);
        const res = chain.applyFilters(emptyContext, baseOpts, init, []);
        expect(res.visibleNodes).toEqual(init);
        expect(res.warnings).toEqual([]);
        expect(res.activeRelationships).toEqual([]);
        expect(res.seedNodes).toBeUndefined();
    });

    it('strategies are applied in order and can modify visible set', () => {
        const chain = new VisibilityFilterChain();
        const s1: VisibilityFilterStrategy = {
            applyFilter: () => ({ visibleNodes: new Set(['x']), warnings: [] })
        };
        const s2: VisibilityFilterStrategy = {
            applyFilter: () => ({ visibleNodes: new Set(['y']), warnings: ['warn'] })
        };
        chain.addStrategy(s1).addStrategy(s2);
        const res = chain.applyFilters(emptyContext, baseOpts, new Set(['a']), []);
        expect(res.visibleNodes).toEqual(new Set(['y']));
        expect(res.warnings).toContain('warn');
    });

    it('propagates activeRelationships from strategies', () => {
        const rels: CalmRelationshipCanonicalModel[] = [
            { 'unique-id': 'r1', 'relationship-type': { 'deployed-in': { container: 'C', nodes: ['n'] } } }
        ];
        const s: VisibilityFilterStrategy = {
            applyFilter: (_ctx, _opts, current, _rels) => ({
                visibleNodes: current,
                activeRelationships: rels,
                warnings: []
            })
        };
        const chain = new VisibilityFilterChain().addStrategy(s);
        const res = chain.applyFilters(emptyContext, baseOpts, new Set(['n']), []);
        expect(res.activeRelationships).toEqual(rels);
    });

    it('propagates seedNodes from strategies', () => {
        const seeds = new Set(['seed1']);
        const s: VisibilityFilterStrategy = {
            applyFilter: (_ctx, _opts, current, _rels) => ({
                visibleNodes: current,
                seedNodes: seeds,
                warnings: []
            })
        };
        const chain = new VisibilityFilterChain().addStrategy(s);
        const res = chain.applyFilters(emptyContext, baseOpts, new Set(['n']), []);
        expect(res.seedNodes).toBe(seeds);
    });

    it('accumulates warnings across multiple strategies', () => {
        const s1: VisibilityFilterStrategy = {
            applyFilter: () => ({ visibleNodes: new Set(['a']), warnings: ['w1'] })
        };
        const s2: VisibilityFilterStrategy = {
            applyFilter: () => ({ visibleNodes: new Set(['b']), warnings: ['w2'] })
        };
        const chain = new VisibilityFilterChain().addStrategy(s1).addStrategy(s2);
        const res = chain.applyFilters(emptyContext, baseOpts, new Set(), []);
        expect(res.warnings).toEqual(['w1', 'w2']);
    });

    it('passes updated visibleNodes and activeRelationships through the chain', () => {
        const s1: VisibilityFilterStrategy = {
            applyFilter: (_ctx, _opts, _current, _rels) => ({
                visibleNodes: new Set(['x']),
                activeRelationships: [{ 'unique-id': 'r1', 'relationship-type': { 'deployed-in': { container: 'C', nodes: ['x'] } } }],
                warnings: []
            })
        };
        const s2: VisibilityFilterStrategy = {
            applyFilter: (_ctx, _opts, current, rels) => {
                // Should see s1’s visibleNodes and activeRelationships
                expect(current).toEqual(new Set(['x']));
                expect(rels[0]['unique-id']).toBe('r1');
                return { visibleNodes: new Set(['y']), warnings: [] };
            }
        };
        const chain = new VisibilityFilterChain().addStrategy(s1).addStrategy(s2);
        const res = chain.applyFilters(emptyContext, baseOpts, new Set(['init']), []);
        expect(res.visibleNodes).toEqual(new Set(['y']));
    });
});
