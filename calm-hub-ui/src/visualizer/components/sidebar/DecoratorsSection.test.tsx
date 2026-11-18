import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecoratorsSection } from './DecoratorsSection.js';
import { DecoratorsContext } from '../../context/DecoratorsContext.js';
import type { Decorator } from '../../contracts/contracts.js';

const decorator = (uniqueId: string, appliesTo: string[]): Decorator => ({
    uniqueId,
    type: 'observability',
    target: ['/api/calm/namespaces/finos/architectures/1/versions/1-0-0'],
    appliesTo,
    data: { owner: uniqueId },
});

const section = (elementId: string, decorators: Decorator[], drawnAs: ReadonlyMap<string, string> = new Map()) => (
    <DecoratorsContext.Provider value={{ decorators, drawnAs }}>
        <DecoratorsSection elementId={elementId} />
    </DecoratorsContext.Provider>
);

function renderSection(elementId: string, decorators: Decorator[], drawnAs: ReadonlyMap<string, string> = new Map()) {
    return render(section(elementId, decorators, drawnAs));
}

describe('DecoratorsSection', () => {
    it('lists only the decorators that apply to the element', () => {
        renderSection('api', [decorator('d1', ['api', 'db']), decorator('d2', ['db']), decorator('d3', ['api'])]);
        expect(screen.getByRole('heading', { name: 'All decorators' })).toBeInTheDocument();
        expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
            'observability decorator d1',
            'observability decorator d3',
        ]);
    });

    it('lists, for a container, the decorators of the containment relationships that its badges count', () => {
        const drawnAs = new Map([['api-in-cluster', 'cluster']]);
        renderSection('cluster', [decorator('d1', ['api-in-cluster']), decorator('d2', ['cluster']), decorator('d3', ['other-rel'])], drawnAs);
        expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
            'observability decorator d1',
            'observability decorator d2',
        ]);
    });

    it('does not list the decorators of a containment relationship on a node that the container holds', () => {
        const { container } = renderSection('trade-api', [decorator('d1', ['api-in-cluster'])], new Map([['api-in-cluster', 'cluster']]));
        expect(container).toBeEmptyDOMElement();
    });

    it('says that it lists all the decorators, not only the ones that a badge counts', () => {
        renderSection('api', [decorator('d1', ['api'])]);
        expect(screen.getByRole('heading', { name: 'All decorators' })).toBeInTheDocument();
        expect(screen.getByText(/older ones that a badge does not count/)).toBeInTheDocument();
    });

    it('keeps a card and its view when a decorator arrives earlier in the list', () => {
        const { rerender } = renderSection('api', [decorator('d1', ['api']), decorator('d2', ['api'])]);
        fireEvent.click(within(screen.getByRole('article', { name: 'observability decorator d2' })).getByRole('button', { name: 'JSON' }));
        rerender(section('api', [decorator('d0', ['api']), decorator('d1', ['api']), decorator('d2', ['api'])]));
        const pressed = (name: string) =>
            within(screen.getByRole('article', { name })).getByRole('button', { name: 'JSON' }).getAttribute('aria-pressed');
        expect(pressed('observability decorator d2')).toBe('true');
        expect(pressed('observability decorator d1')).toBe('false');
    });

    it('renders nothing when no decorator applies to the element', () => {
        const { container } = renderSection('web', [decorator('d1', ['api'])]);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing outside a provider', () => {
        const { container } = render(<DecoratorsSection elementId="api" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('skips a decorator with no applies-to', () => {
        const broken = { ...decorator('d1', []), appliesTo: undefined } as unknown as Decorator;
        const { container } = renderSection('api', [broken]);
        expect(container).toBeEmptyDOMElement();
    });

    it('lists a decorator with no type, and shows its timestamps when present', () => {
        const untyped: Decorator = { ...decorator('d1', ['api']), type: undefined, updateDateTime: '2026-03-02T08:00:00Z' };
        renderSection('api', [untyped]);
        expect(screen.getByRole('article', { name: '(no type) decorator d1' })).toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
        expect(screen.queryByText('Created')).not.toBeInTheDocument();
    });
});
