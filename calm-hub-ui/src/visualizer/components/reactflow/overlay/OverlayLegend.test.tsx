import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayLegend } from './OverlayLegend.js';
import { DecoratorOverlayContext, type DecoratorOverlayState } from '../../../context/DecoratorOverlayContext.js';
import { BUILTIN_DECORATOR_VIEWS } from '../../../../test-support/decorator-views.js';
import type { ElementOverlay, OverlayDecoratorView, OverlayStatus, ViewOverlay } from '../../../contracts/contracts.js';
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
        expect(rows[0]).toHaveTextContent('Control evaluations1 Error2 OK');
        expect(rows[1]).toHaveTextContent('Deployments1 Warning');
    });

    it('toggles a view, and shows a hidden view unchecked', () => {
        const state = renderLegend({ hiddenViews: new Set(['deployment']) });
        expect(screen.getByRole('checkbox', { name: 'Control evaluations' })).toBeChecked();
        const deployments = screen.getByRole('checkbox', { name: 'Deployments' });
        expect(deployments).not.toBeChecked();

        fireEvent.click(deployments);
        expect(state.toggleView).toHaveBeenCalledWith('deployment');
    });

    it('offers View all only where the decorators can be listed', () => {
        const onOpenView = vi.fn();
        renderLegend({ onOpenView });
        fireEvent.click(screen.getByRole('button', { name: 'View all Deployments' }));
        expect(onOpenView).toHaveBeenCalledWith(deploymentView);
    });

    it('names each View all button after its view, so no two have the same name', () => {
        renderLegend({ onOpenView: vi.fn() });
        expect(screen.getAllByRole('button', { name: /^View all/ }).map((button) => button.getAttribute('aria-label'))).toEqual([
            'View all Control evaluations',
            'View all Deployments',
        ]);
    });

    it('has no View all without a list to open', () => {
        renderLegend({});
        expect(screen.queryByRole('button', { name: /^View all/ })).not.toBeInTheDocument();
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
        renderAt(true, new Set(['deployment']));
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
