import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionSummary } from '../../model/extensions.js';
import type { DiagramLensContribution, Notation } from '../../model/lens.js';
import { ExtensionCallError, ExtensionService } from '../../service/extension-service.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { DiagramLensView, type DiagramLensViewProps } from './DiagramLensView.js';

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

    it('selects the CALM element of a node, and follows its link to other parameters', async () => {
        const { onParamsChange, onSelectElement } = show();
        fireEvent.click(await screen.findByRole('button', { name: 'Online Shop' }));
        expect(onSelectElement).toHaveBeenCalledWith('shop');
        expect(onParamsChange).toHaveBeenCalledWith({ level: 'container' });
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
});
