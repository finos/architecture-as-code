import { describe, it, expect } from 'vitest';
import { NodeFocusStrategy } from './node-focus-strategy';
import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const baseOpts = (): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false,
    theme: 'light',
});

const ctx = (ids: string[]): CalmCoreCanonicalModel => ({
    nodes: ids.map(id => ({
        'unique-id': id,
        'node-type': 'service',
        name: id,
        description: ''
    })),
    relationships: []
});

describe('NodeFocusStrategy', () => {
    it('no focus-nodes → returns currentVisible unchanged', () => {
        const strat = new NodeFocusStrategy();
        const res = strat.applyFilter(ctx(['n1', 'n2']), baseOpts(), new Set(['n1']), []);
        expect(res.visibleNodes).toEqual(new Set(['n1']));
        expect(res.warnings).toEqual([]);
        expect(res.seedNodes).toBeUndefined();
    });

    it('focus-nodes seeds visibleNodes with valid IDs only', () => {
        const strat = new NodeFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusNodes: ['n1', 'n3', 'n1'] };
        const res = strat.applyFilter(ctx(['n1', 'n2']), opts, new Set(), []);
        expect(res.visibleNodes).toEqual(new Set(['n1']));
        expect(res.seedNodes).toEqual(new Set(['n1']));
        expect(res.warnings.join(' ')).toMatch(/n3/);
    });

    it('all invalid focus-nodes → empty visibleNodes + warning', () => {
        const strat = new NodeFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusNodes: ['x', 'y'] };
        const res = strat.applyFilter(ctx(['n1']), opts, new Set(), []);
        expect(res.visibleNodes.size).toBe(0);
        expect(res.seedNodes).toEqual(new Set<string>());
        expect(res.warnings.length).toBeGreaterThan(0);
    });
});
