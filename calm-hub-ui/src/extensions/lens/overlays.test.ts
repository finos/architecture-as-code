import { describe, expect, it } from 'vitest';
import type { Decorator, DecoratorView } from '../../visualizer/contracts/contracts.js';
import { BUILTIN_DECORATOR_VIEWS } from '../../visualizer/overlay/builtinDecoratorViews.js';
import type { LensReply } from '../../model/lens.js';
import { lensOverlayKey, lensOverlays } from './overlays.js';

const deployments = BUILTIN_DECORATOR_VIEWS.filter((view) => view.id === 'deployment');
const risk: DecoratorView = {
    id: 'release-risk', label: 'Release risk', match: { type: 'release-risk' },
    overlay: { status: '/risk', map: { low: 'ok', medium: 'warn', high: 'error' }, default: 'info', label: '/summary' },
    source: { id: 'release-tracker', name: 'Release tracker', builtIn: false },
};
const deployment = (id: string, appliesTo: string[], status: string, start = '2026-11-17T10:00:00Z'): Decorator => ({
    uniqueId: id, type: 'deployment', target: [], targetType: [], appliesTo, data: { status, 'start-time': start },
} as unknown as Decorator);

const graph = (nodes: { id: string; calm?: string[] }[], edges: { id: string; calm?: string[] }[] = [], groups: { id: string; calm?: string[] }[] = []) =>
    ({ nodes: nodes.map((node) => ({ ...node, label: node.id })), edges: edges.map((edge) => ({ ...edge, source: nodes[0].id, target: nodes[0].id })), groups }) as LensReply['graph'];

describe('lensOverlays', () => {
    it('draws a decorator only on the lens element that names its CALM element, keyed apart for nodes, groups and edges', () => {
        const [overlay] = lensOverlays(deployments, [deployment('d1', ['api'], 'failed'), deployment('d2', ['web-to-api'], 'failed')], [],
            graph([{ id: 'api', calm: ['api'] }, { id: 'web', calm: ['web'] }], [{ id: 'api', calm: ['web-to-api'] }], [{ id: 'api' }]));
        expect([...overlay.elements.keys()].sort()).toEqual([lensOverlayKey('edge', 'api'), lensOverlayKey('node', 'api')]);
        expect(overlay.elements.get(lensOverlayKey('node', 'api'))).toMatchObject({ status: 'error', value: 'failed' });
        expect(overlay.notDrawn).toEqual([]);
    });

    it('joins the decorators of each CALM element that a lens element stands for, worst first, and counts a shared one once', () => {
        const shared = deployment('shared', ['a', 'b'], 'completed');
        const [overlay] = lensOverlays(deployments, [shared, deployment('bad', ['b'], 'failed', '2026-11-17T11:00:00Z')], [], graph([{ id: 'ab', calm: ['a', 'b'] }]));
        const drawn = overlay.elements.get(lensOverlayKey('node', 'ab'))!;
        expect(drawn.status).toBe('error');
        expect(drawn.entries.map((entry) => entry.decorator.uniqueId)).toEqual(['bad', 'shared']);
    });

    it('lists a decorated CALM element that no lens element names, instead of moving its decorator', () => {
        const [overlay] = lensOverlays(deployments, [deployment('d', ['queue'], 'pending')], [], graph([{ id: 'api', calm: ['api'] }]));
        expect(overlay.elements.size).toBe(0);
        expect(overlay.notDrawn).toEqual(['queue']);
    });

    it('folds a decorator on a containment relationship into its container, as the CALM diagram does', () => {
        const relationships = [{ 'unique-id': 'shop-has', 'relationship-type': { 'composed-of': { container: 'shop', nodes: ['api'] } } }];
        const [overlay] = lensOverlays(deployments, [deployment('d', ['shop-has'], 'failed')], relationships, graph([{ id: 'shop', calm: ['shop'] }]));
        expect(overlay.elements.get(lensOverlayKey('node', 'shop'))?.status).toBe('error');
    });

    it('gives each view its own overlay, so one element can show several', () => {
        const decorators = [deployment('d', ['gw'], 'in-progress'),
            { uniqueId: 'r', type: 'release-risk', appliesTo: ['gw'], data: { risk: 'medium', summary: 'Canary rollout' } } as unknown as Decorator];
        const result = lensOverlays([...deployments, risk], decorators, [], graph([{ id: 'gw', calm: ['gw'] }]));
        expect(result.map(({ view, elements }) => [view.id, elements.get(lensOverlayKey('node', 'gw'))?.status])).toEqual([['deployment', 'info'], ['release-risk', 'warn']]);
    });
});
