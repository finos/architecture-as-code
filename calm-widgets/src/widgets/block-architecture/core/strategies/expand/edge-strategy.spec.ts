import { describe, it, expect } from 'vitest';
import { EdgeStrategy } from './edge-strategy';
import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const opts = (edges: NormalizedOptions['edges'], direction: NormalizedOptions['direction']): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges,
    direction,
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false
});

const relConnects = (id: string, a: string, b: string): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': {
        connects: { source: { node: a }, destination: { node: b } }
    }
});

const relInteracts = (id: string, actor: string, nodes: string[]): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': { interacts: { actor, nodes } }
});

const relDeployedIn = (id: string, container: string, nodes: string[]): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': { 'deployed-in': { container, nodes } }
});

const relComposedOf = (id: string, container: string, nodes: string[]): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': { 'composed-of': { container, nodes } }
});

describe('EdgeStrategy', () => {
    it('passes through when edges !== connected OR no visible nodes', () => {
        const strat = new EdgeStrategy();
        const context: CalmCoreCanonicalModel = { nodes: [], relationships: [] };

        // edges != connected
        const res1 = strat.applyFilter(context, opts('none', 'both'), new Set(['a']), []);
        expect(res1.visibleNodes).toEqual(new Set(['a']));

        // connected but no visible seeds
        const res2 = strat.applyFilter(context, opts('connected', 'both'), new Set(), []);
        expect(res2.visibleNodes.size).toBe(0);
    });

    it('expands one hop for connects when direction="both"', () => {
        const strat = new EdgeStrategy();
        const r = relConnects('r1', 'a', 'b');
        const res = strat.applyFilter(
            { nodes: [], relationships: [r] },
            opts('connected', 'both'),
            new Set(['a']),
            [r]
        );
        expect(res.visibleNodes).toEqual(new Set(['a', 'b']));
    });

    it('direction="out": adds destination if source is visible; not vice versa', () => {
        const strat = new EdgeStrategy();
        const r = relConnects('r', 'a', 'b');
        const base = { nodes: [], relationships: [r] };

        const fromSource = strat.applyFilter(base, opts('connected', 'out'), new Set(['a']), [r]);
        expect(fromSource.visibleNodes).toEqual(new Set(['a', 'b']));

        const fromDest = strat.applyFilter(base, opts('connected', 'out'), new Set(['b']), [r]);
        expect(fromDest.visibleNodes).toEqual(new Set(['b'])); // no back edge
    });

    it('direction="in": adds source if destination is visible; not vice versa', () => {
        const strat = new EdgeStrategy();
        const r = relConnects('r', 'a', 'b');
        const base = { nodes: [], relationships: [r] };

        const fromDest = strat.applyFilter(base, opts('connected', 'in'), new Set(['b']), [r]);
        expect(fromDest.visibleNodes).toEqual(new Set(['b', 'a']));

        const fromSource = strat.applyFilter(base, opts('connected', 'in'), new Set(['a']), [r]);
        expect(fromSource.visibleNodes).toEqual(new Set(['a'])); // no forward edge
    });

    it('interacts: any participant visible pulls in all others (bidirectional include)', () => {
        const strat = new EdgeStrategy();
        const r = relInteracts('ri', 'actor', ['x', 'y']);
        const base = { nodes: [], relationships: [r] };

        const res1 = strat.applyFilter(base, opts('connected', 'both'), new Set(['actor']), [r]);
        expect(res1.visibleNodes).toEqual(new Set(['actor', 'x', 'y']));

        const res2 = strat.applyFilter(base, opts('connected', 'both'), new Set(['x']), [r]);
        expect(res2.visibleNodes).toEqual(new Set(['x', 'actor', 'y']));
    });

    it('does NOT expand on composed-of / deployed-in (handled elsewhere)', () => {
        const strat = new EdgeStrategy();
        const rc = relComposedOf('c', 'C1', ['a']);
        const rd = relDeployedIn('d', 'D1', ['b']);
        const base = { nodes: [], relationships: [rc, rd] };

        const res = strat.applyFilter(base, opts('connected', 'both'), new Set(['a', 'b']), [rc, rd]);
        // stays the same – no expansion from container relationships
        expect(res.visibleNodes).toEqual(new Set(['a', 'b']));
    });

    it('single-hop only: does not chain newly added nodes within the same pass', () => {
        const strat = new EdgeStrategy();
        const r1 = relConnects('r1', 'a', 'b');
        const r2 = relConnects('r2', 'b', 'c');
        const base = { nodes: [], relationships: [r1, r2] };

        const res = strat.applyFilter(base, opts('connected', 'both'), new Set(['a']), [r1, r2]);
        expect(res.visibleNodes).toEqual(new Set(['a', 'b'])); // c is NOT included (no multi-hop)
    });

    it('idempotent: expanded set always contains currentVisible', () => {
        const strat = new EdgeStrategy();
        const r = relConnects('r', 'a', 'b');
        const base = { nodes: [], relationships: [r] };

        const cur = new Set(['b']);
        const res = strat.applyFilter(base, opts('connected', 'in'), cur, [r]);
        for (const n of cur) expect(res.visibleNodes.has(n)).toBe(true);
    });
});
