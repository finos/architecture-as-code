import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionSummary } from '../../model/extensions.js';
import type { DiagramLensContribution, Notation } from '../../model/lens.js';
import { ExtensionCallError, ExtensionService } from '../../service/extension-service.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { isExactVersion } from '../../navigation/returnPoints.js';
import { DiagramLensView, type DiagramLensViewProps } from './DiagramLensView.js';
import { BUILTIN_DECORATOR_VIEWS } from '../../visualizer/overlay/builtinDecoratorViews.js';
import type { Decorator } from '../../visualizer/contracts/contracts.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';

const lens: DiagramLensContribution = {
    id: 'c4', title: 'C4', route: 'lens', notation: 'notation.json',
    params: { level: { values: ['context', 'container'], default: 'context' } },
};
const extension: ExtensionSummary = {
    id: 'c4', name: 'C4 model', hubApi: 0,
    routes: [{ id: 'lens', method: 'GET', path: '/lens/{namespace}', scope: 'read', readOnly: true }],
    contributes: { 'diagram-lens': [lens] },
};
const reply = {
    hubApi: 0, kind: 'graph',
    graph: {
        nodes: [
            { id: 'shop', label: 'Online Shop', calm: ['shop'], link: { params: { level: 'container' } } },
            { id: 'pay', label: 'Payments', calm: ['payments'] },
        ],
        edges: [{ id: 'e', source: 'shop', target: 'pay', label: 'Takes payment' }],
    },
    controls: [{ type: 'segmented', param: 'level', items: [{ value: 'context', label: 'Context' }, { value: 'container', label: 'Container' }] }],
    panels: [{ title: 'Notes', blocks: [{ type: 'alert', tone: 'warning', text: 'payments is guessed' }] }],
};

let call: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    vi.spyOn(ExtensionService.prototype, 'fetchLensNotation').mockResolvedValue({});
    vi.spyOn(ExtensionService.prototype, 'fetchCoreNotation').mockResolvedValue(core as Notation);
    call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
    vi.spyOn(ExtensionService.prototype, 'fetchDecoratorViews').mockResolvedValue([...BUILTIN_DECORATOR_VIEWS, {
        id: 'release-risk', label: 'Release risk', match: { type: 'release-risk' },
        overlay: { status: '/risk', map: { low: 'ok', medium: 'warn', high: 'error' }, default: 'info', label: '/summary' },
        source: { id: 'release-tracker', name: 'Release tracker', builtIn: false },
    }]);
});
afterEach(() => vi.restoreAllMocks());

function show(props: Partial<DiagramLensViewProps> = {}) {
    const all: DiagramLensViewProps = {
        extension, lens, context: { namespace: 'finos', resourceType: 'architectures', resourceId: 'shop', version: '1.0.0' },
        params: {}, onParamsChange: vi.fn(), onSelectElement: vi.fn(), ...props,
    };
    const view = render(<MemoryRouter><DiagramLensView {...all} /></MemoryRouter>);
    return { ...all, rerender: (next: Partial<DiagramLensViewProps>) => view.rerender(<MemoryRouter><DiagramLensView {...all} {...next} /></MemoryRouter>) };
}

describe('DiagramLensView', () => {
    it('draws the graph, its controls and its notes, and sends only the declared parameters', async () => {
        show({ params: { level: 'component', tab: 'json' } });
        expect(await screen.findByRole('button', { name: 'Online Shop' })).toBeInTheDocument();
        expect(screen.getByText('Takes payment')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Context' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('complementary', { name: 'Lens notes' })).toHaveTextContent('payments is guessed');
        expect(call).toHaveBeenCalledWith('c4', extension.routes[0],
            { namespace: 'finos', resourceType: 'architectures', resourceId: 'shop', version: '1.0.0', level: 'context' }, expect.any(AbortSignal));
    });

    it('shows the value that the reply was drawn with when the URL names none', async () => {
        const scoped = { ...lens, params: { ...lens.params, scope: { pattern: '^[a-z]+$' } } };
        call.mockResolvedValue({
            ...reply,
            controls: [{ type: 'select', param: 'scope', label: 'System', value: 'payments', items: [{ value: 'shop', label: 'Online Shop' }, { value: 'payments', label: 'Payments' }] }],
        });
        show({ lens: scoped, extension: { ...extension, contributes: { 'diagram-lens': [scoped] } } });
        expect(await screen.findByRole('combobox', { name: 'System' })).toHaveValue('payments');
        expect(screen.queryByRole('option', { name: 'Choose…' })).toBeNull();
    });

    it('selects the CALM element of a node, and follows its link to other parameters in the same change', async () => {
        const { onParamsChange, onSelectElement } = show();
        fireEvent.click(await screen.findByRole('button', { name: 'Online Shop' }));
        expect(onParamsChange).toHaveBeenCalledWith({ level: 'container' }, 'shop');
        fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
        expect(onSelectElement).toHaveBeenCalledWith('payments');
        expect(onSelectElement).toHaveBeenCalledTimes(1);
    });

    // A timeline moves a landing on the latest version to its current moment, unless the navigation names the version.
    it('opens the exact version and node that a Hub link of a node names', async () => {
        const linked = { ...reply, graph: { ...reply.graph, nodes: [{ id: 'ledger', label: 'Ledger', link: { hub: { namespace: 'finos', type: 'architectures', id: 'ledger', version: '2.0.0', element: 'api' } } }], edges: [] } };
        call.mockResolvedValue(linked);
        function Opened() {
            const location = useLocation();
            return <p data-testid="opened">{`${location.pathname}${location.search} ${isExactVersion(location)}`}</p>;
        }
        const props: DiagramLensViewProps = {
            extension, lens, context: { namespace: 'finos', resourceType: 'architectures', resourceId: 'shop', version: '1.0.0' },
            params: {}, onParamsChange: vi.fn(), onSelectElement: vi.fn(),
        };
        render(
            <MemoryRouter initialEntries={['/finos/architectures/shop/1.0.0']}>
                <Routes>
                    <Route path="/finos/architectures/shop/1.0.0" element={<DiagramLensView {...props} />} />
                    <Route path="/finos/architectures/ledger/2.0.0" element={<Opened />} />
                </Routes>
            </MemoryRouter>
        );
        fireEvent.click(await screen.findByRole('button', { name: 'Ledger' }));
        expect(screen.getByTestId('opened')).toHaveTextContent('/finos/architectures/ledger/2.0.0?node=api&exact=1 true');
    });

    it('marks a selection with no new request when the route does not take it', async () => {
        const view = show();
        await screen.findByRole('button', { name: 'Online Shop' });
        view.rerender({ context: { ...view.context, selectedElement: 'payments' } });
        await waitFor(() => expect(document.querySelector('[data-node="pay"] [data-selected]')).not.toBeNull());
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('names the fault of a reply that is not valid', async () => {
        call.mockResolvedValue({ ...reply, graph: { nodes: [{ id: 'a', label: 'A' }], edges: [{ id: 'e', source: 'a', target: 'x' }] } });
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent("The lens reply is not valid.Edge 'e' has an unknown target 'x'.");
    });

    it('shows the title and detail of a problem reply', async () => {
        call.mockRejectedValue(new ExtensionCallError({ title: 'The C4 mapping does not load', detail: 'c4-mapping has no level' }));
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent('The C4 mapping does not loadc4-mapping has no level');
    });

    describe('decorators', () => {
        const decorator = (uniqueId: string, type: string, appliesTo: string[], data: object) =>
            ({ uniqueId, type, target: [], appliesTo, data }) as Decorator;
        const decorators = [
            decorator('d-shop', 'deployment', ['shop'], { status: 'failed', 'start-time': '2026-11-17T10:00:00Z' }),
            decorator('r-shop', 'release-risk', ['shop'], { risk: 'medium', summary: 'Canary rollout' }),
            decorator('d-edge', 'deployment', ['shop-pays'], { status: 'failed', 'start-time': '2026-11-17T10:00:00Z' }),
            decorator('d-gone', 'deployment', ['queue'], { status: 'pending', 'start-time': '2026-11-17T10:00:00Z' }),
        ];
        const decorated = { ...reply, graph: { ...reply.graph, edges: [{ ...reply.graph.edges[0], calm: ['shop-pays'] }] } };
        const badges = (on: string) => [...document.querySelectorAll(`[data-overlay-for="${on}"] [data-overlay-badge]`)].map((badge) => badge.getAttribute('aria-label'));

        it('draws each view as a badge on the lens element that names the CALM element, and says what it does not draw', async () => {
            call.mockResolvedValue(decorated);
            show({ decorators, storage: createMemoryStorage() });
            await screen.findByRole('button', { name: 'Online Shop' });
            await waitFor(() => expect(badges('node:shop')).toEqual(['Deployments · Built-in: Failed', 'Release risk · Release tracker: Medium']));
            expect(badges('node:pay')).toEqual([]);
            expect(badges('edge:e')).toEqual(['Deployments · Built-in: Failed']);
            expect(document.querySelector('[data-node="shop"] [data-overlay-outline]')).not.toBeNull();
            expect(screen.getByTestId('lens-overlays-not-drawn')).toHaveTextContent('Deployments · Built-in: 1 decorated element is not in this view.');
        });

        it('opens the badge details without selecting the node, and the legend turns a view off', async () => {
            call.mockResolvedValue(decorated);
            const { onParamsChange, onSelectElement } = show({ decorators, storage: createMemoryStorage() });
            const badge = await screen.findByRole('button', { name: 'Release risk · Release tracker: Medium' });
            fireEvent.click(badge);
            expect(screen.getByRole('dialog', { name: 'Release risk · Release tracker' })).toHaveTextContent('Canary rollout');
            expect(onParamsChange).not.toHaveBeenCalled();
            expect(onSelectElement).not.toHaveBeenCalled();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('dialog')).toBeNull();
            fireEvent.click(within(screen.getByRole('group', { name: 'Decorator overlays' })).getByRole('checkbox', { name: /Release risk/ }));
            expect(badges('node:shop')).toEqual(['Deployments · Built-in: Failed']);
        });

        it('draws no decorator on an element without calm ids', async () => {
            show({ decorators, storage: createMemoryStorage() });
            await screen.findByRole('button', { name: 'Online Shop' });
            await waitFor(() => expect(badges('node:shop')).toHaveLength(2));
            expect(badges('edge:e')).toEqual([]);
        });

        it('shows the current result in open details, and closes them when the badge goes', async () => {
            call.mockResolvedValue(decorated);
            const risk = (value: string, summary: string) => decorator('r-shop', 'release-risk', ['shop'], { risk: value, summary });
            const view = show({ decorators: [risk('high', 'Old result'), decorators[2]], storage: createMemoryStorage() });
            fireEvent.click(await screen.findByRole('button', { name: 'Release risk · Release tracker: High' }));
            expect(screen.getByRole('dialog')).toHaveTextContent('Old result');

            view.rerender({ decorators: [risk('low', 'New result'), decorators[2]] });
            await screen.findByRole('button', { name: 'Release risk · Release tracker: Low' });
            expect(screen.getByRole('dialog')).toHaveTextContent('New result');

            view.rerender({ decorators: [decorators[2]] });
            await waitFor(() => expect(screen.queryByRole('button', { name: /Release risk/ })).toBeNull());
            expect(screen.queryByRole('dialog')).toBeNull();

            // An edge shows only error and warn, so its badge goes when its relationship becomes ok.
            fireEvent.click(screen.getByRole('button', { name: 'Deployments · Built-in: Failed' }));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            view.rerender({ decorators: [decorator('d-edge', 'deployment', ['shop-pays'], { status: 'completed', 'start-time': '2026-11-17T11:00:00Z' })] });
            await waitFor(() => expect(badges('edge:e')).toEqual([]));
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('keeps a legend row for a view whose decorated elements are all outside the view, so it can be turned on again', async () => {
            const storage = createMemoryStorage();
            storage.setItem('calm-hub-overlay-views', JSON.stringify({ 'deployment/deployment': false }));
            show({ decorators: [decorators[3]], storage });
            await screen.findByRole('button', { name: 'Online Shop' });
            const toggle = await screen.findByRole('checkbox', { name: /Deployments · Built-in/ });
            expect(screen.queryByTestId('lens-overlays-not-drawn')).toBeNull();
            fireEvent.click(toggle);
            expect(screen.getByTestId('lens-overlays-not-drawn')).toHaveTextContent('Deployments · Built-in: 1 decorated element is not in this view.');
        });

        it('wraps many badges to the node width, inside the view box of the diagram', async () => {
            const extra = [1, 2, 3].map((n) => ({
                id: `risk-${n}`, label: `Approval ${n}`, match: { type: `risk-${n}` },
                overlay: { status: '/status', map: { 'approval-required': 'warn' as const } }, source: { id: `risk-${n}`, name: `Risk ${n}`, builtIn: false },
            }));
            vi.mocked(ExtensionService.prototype.fetchDecoratorViews).mockResolvedValue([...BUILTIN_DECORATOR_VIEWS, ...extra]);
            show({
                decorators: [
                    decorator('d-pay', 'deployment', ['payments'], { status: 'rolled-back', 'start-time': '2026-11-17T10:00:00Z' }),
                    ...extra.map((view) => decorator(view.id, view.match.type, ['payments'], { status: 'approval-required' })),
                ],
                storage: createMemoryStorage(),
            });
            await screen.findByRole('button', { name: 'Payments' });
            await waitFor(() => expect(badges('node:pay')).toHaveLength(4));
            const [left, top, width, height] = screen.getByTestId('lens-canvas').getAttribute('viewBox')!.split(' ').map(Number);
            const node = document.querySelector('[data-node="pay"]')!.getAttribute('transform')!;
            const nodeX = Number(/translate\(([-\d.]+)/.exec(node)![1]);
            const placed = [...document.querySelectorAll('[data-overlay-for="node:pay"] [data-overlay-badge]')].map((badge) => {
                const [, x, y] = /translate\(([-\d.]+),([-\d.]+)\)/.exec(badge.getAttribute('transform')!)!.map(Number);
                return { x, y, width: Number(badge.querySelector('rect')!.getAttribute('width')) };
            });
            expect(new Set(placed.map(({ y }) => y)).size).toBeGreaterThan(1);
            for (const { x, y, width: w } of placed) {
                expect(x).toBeGreaterThanOrEqual(left);
                expect(x + w).toBeLessThanOrEqual(left + width);
                expect(y).toBeGreaterThanOrEqual(top);
                expect(y + 18).toBeLessThanOrEqual(top + height);
                expect(x).toBeGreaterThanOrEqual(nodeX);
            }
        });
    });
});
