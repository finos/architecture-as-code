import { describe, it, expect } from 'vitest';
import { ChildrenStrategy } from './children-strategy';
import { CalmCoreCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const ctx: CalmCoreCanonicalModel = { nodes: [], relationships: [] };

const base = (overrides: Partial<NormalizedOptions> = {}): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false,
    theme: 'light',
    ...overrides,
});

describe('ChildrenStrategy', () => {
    it('passes through when includeChildren is "none"', () => {
        const strat = new ChildrenStrategy(new Map());
        const cur = new Set(['a']);
        const res = strat.applyFilter(ctx, base({ includeChildren: 'none', focusNodes: ['c1'] }), cur, []);
        expect(res.visibleNodes).toEqual(cur);
    });

    it('passes through when no focusNodes', () => {
        const strat = new ChildrenStrategy(new Map([['c1', new Set(['n1'])]]));
        const cur = new Set(['seed']);
        const res = strat.applyFilter(ctx, base({ includeChildren: 'all' }), cur, []);
        expect(res.visibleNodes).toEqual(cur);
    });

    it('ignores focus IDs that are not containers (i.e., not in childrenOfContainer map)', () => {
        const children = new Map<string, Set<string>>([['c1', new Set(['n1'])]]);
        const strat = new ChildrenStrategy(children);
        const res = strat.applyFilter(ctx, base({ includeChildren: 'all', focusNodes: ['n1'] }), new Set(), []);
        expect(res.visibleNodes.size).toBe(0);
    });

    it('collects only immediate children in "direct" mode', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set(['n1', 'c2'])],
            ['c2', new Set(['n2'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'direct', focusNodes: ['c1'] }),
            new Set(),
            []
        );
        expect(res.visibleNodes).toEqual(new Set(['n1', 'c2']));
    });

    it('recursively collects all descendants in "all" mode', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set(['n1', 'c2'])],
            ['c2', new Set(['n2', 'c3'])],
            ['c3', new Set(['n3'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'all', focusNodes: ['c1'] }),
            new Set(),
            []
        );
        // includes containers-as-children (c2, c3) and leaf nodes (n1, n2, n3)
        expect(res.visibleNodes).toEqual(new Set(['n1', 'c2', 'n2', 'c3', 'n3']));
    });

    it('merges descendants from multiple focused containers', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set(['a', 'b'])],
            ['c2', new Set(['b', 'c'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'direct', focusNodes: ['c1', 'c2'] }),
            new Set(),
            []
        );
        expect(res.visibleNodes).toEqual(new Set(['a', 'b', 'c']));
    });

    it('does not remove currently visible nodes; only adds descendants', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set(['n1'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'direct', focusNodes: ['c1'] }),
            new Set(['seed']),
            []
        );
        expect(res.visibleNodes).toEqual(new Set(['seed', 'n1']));
    });

    it('is safe when a mentioned container has no children (empty set)', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set()],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'all', focusNodes: ['c1'] }),
            new Set(),
            []
        );
        expect(res.visibleNodes.size).toBe(0);
    });

    it('is safe when a focused container is not in the map at all', () => {
        const children = new Map<string, Set<string>>([
            ['c2', new Set(['n2'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'all', focusNodes: ['c1'] }),
            new Set(),
            []
        );
        expect(res.visibleNodes.size).toBe(0);
    });

    it('prevents duplicate work: repeated children are deduped', () => {
        const children = new Map<string, Set<string>>([
            ['c1', new Set(['x', 'y'])],
            ['c2', new Set(['y', 'z'])],
        ]);
        const strat = new ChildrenStrategy(children);

        const res = strat.applyFilter(
            ctx,
            base({ includeChildren: 'all', focusNodes: ['c1', 'c2'] }),
            new Set(),
            []
        );
        expect(res.visibleNodes).toEqual(new Set(['x', 'y', 'z']));
    });
});
