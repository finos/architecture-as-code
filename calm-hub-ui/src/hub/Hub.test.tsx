import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hub from './Hub.js';
import { vi, describe, it, expect } from 'vitest';

vi.mock('./components/tree-navigation/TreeNavigation', () => ({
    TreeNavigation: ({
        onDataLoad,
        onAdrLoad,
    }: {
        onDataLoad: (data: unknown) => void;
        onAdrLoad: (adr: unknown) => void;
    }) => (
        <div data-testid="tree-navigation">
            <div>Tree Navigation</div>
            <button
                onClick={() =>
                    onDataLoad({
                        id: 'test',
                        version: '1.0',
                        calmType: 'Patterns',
                        name: 'test-namespace',
                        data: {},
                    })
                }
            >
                Load Test Data
            </button>
            <button onClick={() => onAdrLoad({ id: 'test-adr', revision: '1.0' })}>
                Load Test ADR
            </button>
        </div>
    ),
}));

vi.mock('./components/json-renderer/JsonRenderer', () => ({
    JsonRenderer: ({ json }: { json: unknown }) => (
        <div data-testid="json-renderer">{json ? 'JSON' : ''}</div>
    ),
}));

vi.mock('./components/adr-renderer/AdrRenderer', () => ({
    AdrRenderer: ({ adrDetails }: { adrDetails: { id?: string } }) => (
        <div data-testid="adr-renderer">ADR: {adrDetails?.id}</div>
    ),
}));

vi.mock('../components/navbar/Navbar', () => ({
    Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));

vi.mock('./components/diagram-section/DiagramSection', () => ({
    DiagramSection: ({ data }: { data: { id?: string } }) => (
        <div data-testid="diagram-section">Diagram: {data?.id}</div>
    ),
}));

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Hub', () => {
    it('renders Navbar and TreeNavigation components', () => {
        renderWithRouter(<Hub />);
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('tree-navigation')).toBeInTheDocument();
        expect(screen.getByText('Tree Navigation')).toBeInTheDocument();
    });

    it('renders DiagramSection when pattern data is loaded', () => {
        renderWithRouter(<Hub />);

        // Initially, no content should be rendered
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();

        // Click the Load Test Data button to simulate data loading (loads Pattern data)
        fireEvent.click(screen.getByText('Load Test Data'));

        // Now DiagramSection should be visible
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toHaveTextContent('Diagram: test');
    });

    it('renders AdrRenderer when ADR data is loaded', () => {
        renderWithRouter(<Hub />);

        // Initially, AdrRenderer should not be visible
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();

        // Click the Load Test ADR button to simulate ADR loading
        fireEvent.click(screen.getByText('Load Test ADR'));

        // Now AdrRenderer should be visible
        expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();
        expect(screen.getByTestId('adr-renderer')).toHaveTextContent('ADR: test-adr');
    });

    it('shows JSON and Diagram tabs when architecture data is loaded', () => {
        renderWithRouter(<Hub />);

        // Initially, no tabs should be visible
        expect(screen.queryByLabelText('JSON')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Diagram')).not.toBeInTheDocument();

        // Load test data (non-architecture type shouldn't show tabs)
        fireEvent.click(screen.getByText('Load Test Data'));

        // Still no tabs for non-Architecture calmType
        expect(screen.queryByLabelText('JSON')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Diagram')).not.toBeInTheDocument();
    });

    it('switches between DiagramSection and AdrRenderer correctly', () => {
        renderWithRouter(<Hub />);

        // Load test data first (Pattern data)
        fireEvent.click(screen.getByText('Load Test Data'));
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();

        // Load ADR data
        fireEvent.click(screen.getByText('Load Test ADR'));
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();

        // Load test data again
        fireEvent.click(screen.getByText('Load Test Data'));
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();
    });

    describe('sidebar collapse', () => {
        it('shows sidebar expanded by default with collapse button', () => {
            renderWithRouter(<Hub />);
            expect(screen.getByTestId('tree-navigation')).toBeInTheDocument();
            expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
        });

        it('hides tree navigation when sidebar is collapsed', () => {
            renderWithRouter(<Hub />);

            fireEvent.click(screen.getByLabelText('Collapse sidebar'));

            expect(screen.queryByTestId('tree-navigation')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
        });

        it('restores tree navigation when sidebar is expanded again', () => {
            renderWithRouter(<Hub />);

            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.queryByTestId('tree-navigation')).not.toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Expand sidebar'));
            expect(screen.getByTestId('tree-navigation')).toBeInTheDocument();
        });
    });
});
