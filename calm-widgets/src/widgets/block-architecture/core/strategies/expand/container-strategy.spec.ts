import { describe, it, expect } from 'vitest';
import { ContainerStrategy } from './container-strategy';
import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const ctx: CalmCoreCanonicalModel = { nodes: [], relationships: [] };

const base = (includeContainers: NormalizedOptions['includeContainers']): NormalizedOptions => ({
    includeContainers,
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false,
    theme: 'light',
});

describe('ContainerStrategy', () => {
    it('removes containers when includeContainers=none unless focused', () => {
        const all = new Set(['c1', 'c2']);
        const strat = new ContainerStrategy(all);
        const current = new Set(['c1', 'n1']);

        // remove c1
        const res = strat.applyFilter(ctx, base('none'), current, []);
        expect(res.visibleNodes.has('c1')).toBe(false);
        expect(res.visibleNodes.has('n1')).toBe(true);

        // keep c1 when focused
        const res2 = strat.applyFilter(
            ctx,
            { ...base('none'), focusNodes: ['c1'] },
            current,
            []
        );
        expect(res2.visibleNodes.has('c1')).toBe(true);
        expect(res2.visibleNodes.has('n1')).toBe(true);
    });

    it('passes through when includeContainers is not "none"', () => {
        const all = new Set(['c1', 'c2']);
        const strat = new ContainerStrategy(all);
        const current = new Set(['c1', 'n1']);

        for (const mode of ['parents', 'all'] as const) {
            const res = strat.applyFilter(ctx, base(mode), current, []);
            expect(res.visibleNodes).toEqual(current);
        }
    });

    it('does nothing for mentioned-but-not-visible containers', () => {
        const all = new Set(['c1', 'c2']); // c2 is mentioned but not currently visible
        const strat = new ContainerStrategy(all);
        const current = new Set(['c1', 'n1']);

        const res = strat.applyFilter(ctx, base('none'), current, []);
        // c2 not in current → no effect; c1 removed
        expect(res.visibleNodes.has('c2')).toBe(false);
        expect(res.visibleNodes.has('c1')).toBe(false);
        expect(res.visibleNodes.has('n1')).toBe(true);
    });

    it('treats empty focusNodes same as undefined (no containers preserved)', () => {
        const all = new Set(['c1']);
        const strat = new ContainerStrategy(all);
        const current = new Set(['c1']);

        const resUndef = strat.applyFilter(ctx, base('none'), current, []);
        const resEmpty = strat.applyFilter(ctx, { ...base('none'), focusNodes: [] }, current, []);

        expect(resUndef.visibleNodes.size).toBe(0);
        expect(resEmpty.visibleNodes.size).toBe(0);
    });
});
