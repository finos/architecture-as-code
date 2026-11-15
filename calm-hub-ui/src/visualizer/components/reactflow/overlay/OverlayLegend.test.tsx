import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayLegend } from './OverlayLegend.js';
import { DecoratorOverlayContext, type DecoratorOverlayState } from '../../../context/DecoratorOverlayContext.js';
import { BUILTIN_DECORATOR_VIEWS } from '../../../../test-support/decorator-views.js';
import type { ElementOverlay, OverlayDecoratorView, OverlayStatus, ViewOverlay } from '../../../contracts/contracts.js';
import { fakeElement, fakeView, fakeViewOverlays } from '../../../../test-support/fake-overlays.js';
import { BUILTIN_MARKER, extensionMarkerColour } from '../../../../extensions/extensionIdentity.js';
import { mockViewport } from '../../../../test-support/layout-mocks.js';

const [evaluationView, deploymentView] = BUILTIN_DECORATOR_VIEWS as OverlayDecoratorView[];
const element = (status: OverlayStatus): ElementOverlay => ({ status, value: status, entries: [] });

function renderLegend(state: Partial<DecoratorOverlayState>) {
    const value: DecoratorOverlayState = {
        overlays: [
            { view: evaluationView, elements: new Map([['a', element('error')], ['b', element('ok')], ['c', element('ok')]]) },
            { view: deploymentView, elements: new Map([['a', element('warn')]]) },
        ],
        hiddenViews: new Set(),
        toggleView: vi.fn(),
        ...state,
    };
    render(
        <DecoratorOverlayContext.Provider value={value}>
            <OverlayLegend />
        </DecoratorOverlayContext.Provider>
    );
    return value;
}

describe('OverlayLegend', () => {
    it('renders nothing when no view has an element on the diagram', () => {
        renderLegend({ overlays: [] });
        expect(screen.queryByTestId('overlay-legend')).not.toBeInTheDocument();
    });

    it('lists each view with how many elements show each status, worst first', () => {
        renderLegend({});
        const rows = screen.getAllByTestId('overlay-legend-row');
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('Control evaluations · Built-in1 Error2 OK');
        expect(rows[1]).toHaveTextContent('Deployments · Built-in1 Warning');
    });

    it('toggles a view, and shows a hidden view unchecked', () => {
        const state = renderLegend({ hiddenViews: new Set(['deployment/deployment']) });
        expect(screen.getByRole('checkbox', { name: 'Control evaluations · Built-in' })).toBeChecked();
        const deployments = screen.getByRole('checkbox', { name: 'Deployments · Built-in' });
        expect(deployments).not.toBeChecked();

        fireEvent.click(deployments);
        expect(state.toggleView).toHaveBeenCalledWith('deployment/deployment');
    });

    it('offers View all only where the decorators can be listed', () => {
        const onOpenView = vi.fn();
        renderLegend({ onOpenView });
        fireEvent.click(screen.getByRole('button', { name: 'View all Deployments · Built-in' }));
        expect(onOpenView).toHaveBeenCalledWith(deploymentView);
    });

    it('names each View all button after its view, so no two have the same name', () => {
        renderLegend({ onOpenView: vi.fn() });
        expect(screen.getAllByRole('button', { name: /^View all/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
            'View all Control evaluations · Built-in',
            'View all Deployments · Built-in',
        ]);
    });

    it('has no View all without a list to open', () => {
        renderLegend({});
        expect(screen.queryByRole('button', { name: /^View all/ })).not.toBeInTheDocument();
    });
});

describe('OverlayLegend with extensions', () => {
    function renderOverlays(overlays: ViewOverlay[], state: Partial<DecoratorOverlayState> = {}) {
        const value: DecoratorOverlayState = { overlays, hiddenViews: new Set(), toggleView: vi.fn(), setViewsShown: vi.fn(), ...state };
        render(
            <DecoratorOverlayContext.Provider value={value}>
                <OverlayLegend />
            </DecoratorOverlayContext.Provider>
        );
        return value;
    }

    it('labels each of ten rows with the view and extension, and a stable extension marker', () => {
        renderOverlays(fakeViewOverlays(10));
        const rows = screen.getAllByTestId('overlay-legend-row');
        expect(rows).toHaveLength(10);
        expect(rows[0]).toHaveTextContent('View risk · Extension ext-1');
        const markers = screen.getAllByTestId('overlay-marker');
        expect(markers[0].dataset.colour).toBe(extensionMarkerColour('ext-1'));
        expect(markers[9].dataset.colour).toBe(extensionMarkerColour('ext-10'));
        expect(screen.getByTestId('overlay-legend').style.overflowY).toBe('auto');
    });

    it('marks a built-in view', () => {
        renderOverlays([{ view: fakeView('deployment', 'deployment', 'Deployments'), elements: new Map([['n1', fakeElement('ok')]]) }]);
        expect(screen.getByTestId('overlay-legend-row')).toHaveTextContent('View deployment · Built-in');
        expect(screen.getByTestId('overlay-marker').dataset.colour).toBe(BUILTIN_MARKER);
    });

    it('toggles all the views of one extension, and still each view', () => {
        const overlays = [
            { view: fakeView('ext-1', 'risk'), elements: new Map([['n1', fakeElement('ok')]]) },
            { view: fakeView('ext-1', 'cost'), elements: new Map([['n1', fakeElement('warn')]]) },
            { view: fakeView('ext-2', 'risk'), elements: new Map([['n1', fakeElement('ok')]]) },
        ];
        const state = renderOverlays(overlays, { hiddenViews: new Set(['ext-1/cost']) });
        expect(screen.getAllByTestId('overlay-legend-group')).toHaveLength(1);
        const group = screen.getByRole('checkbox', { name: 'All views of Extension ext-1' }) as HTMLInputElement;
        expect(group.indeterminate).toBe(true);

        fireEvent.click(group);
        expect(state.setViewsShown).toHaveBeenCalledWith(['ext-1/risk', 'ext-1/cost'], true);

        fireEvent.click(screen.getByRole('checkbox', { name: 'View cost · Extension ext-1' }));
        expect(state.toggleView).toHaveBeenCalledWith('ext-1/cost');
    });

    it('switches an extension off when all its views are on', () => {
        const overlays = [
            { view: fakeView('ext-1', 'risk'), elements: new Map([['n1', fakeElement('ok')]]) },
            { view: fakeView('ext-1', 'cost'), elements: new Map([['n1', fakeElement('ok')]]) },
        ];
        const state = renderOverlays(overlays);
        fireEvent.click(screen.getByRole('checkbox', { name: 'All views of Extension ext-1' }));
        expect(state.setViewsShown).toHaveBeenCalledWith(['ext-1/risk', 'ext-1/cost'], false);
    });
});

describe('OverlayLegend below 1024px', () => {
    let restoreViewport = () => {};
    afterEach(() => restoreViewport());

    function renderAt(isMobile: boolean, hiddenViews: ReadonlySet<string> = new Set()) {
        restoreViewport = mockViewport(isMobile);
        const overlays: ViewOverlay[] = [
            { view: evaluationView, elements: new Map([['a', element('error')]]) },
            { view: deploymentView, elements: new Map([['a', element('warn')]]) },
        ];
        render(
            <DecoratorOverlayContext.Provider value={{ overlays, hiddenViews, toggleView: vi.fn() }}>
                <OverlayLegend />
            </DecoratorOverlayContext.Provider>
        );
    }

    it('starts collapsed to one button that says how many views are on, and expands', () => {
        renderAt(true, new Set(['deployment/deployment']));
        const toggle = screen.getByRole('button', { name: 'Overlays (1 of 2 on)' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryAllByTestId('overlay-legend-row')).toHaveLength(0);

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getAllByTestId('overlay-legend-row')).toHaveLength(2);

        fireEvent.click(toggle);
        expect(screen.queryAllByTestId('overlay-legend-row')).toHaveLength(0);
    });

    it('shows every row with no collapse button on a desktop', () => {
        renderAt(false);
        expect(screen.getAllByTestId('overlay-legend-row')).toHaveLength(2);
        expect(screen.queryByRole('button', { name: /^Overlays/ })).not.toBeInTheDocument();
        expect(screen.getByTestId('overlay-legend').style.maxWidth).toBe('calc(100vw - 120px)');
    });
});
