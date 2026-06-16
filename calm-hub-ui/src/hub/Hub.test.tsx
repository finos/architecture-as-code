import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hub from './Hub.js';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { authStore } from '../service/utils/auth-store.js';

/**
 * Force `useIsMobile()` (which reads window.matchMedia) to report a mobile
 * viewport. Returns a restore function.
 */
function mockMobileViewport(isMobile: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
        matches: isMobile,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    return () => {
        window.matchMedia = original;
    };
}

vi.mock('./components/tree-navigation/TreeNavigation', () => ({
    TreeNavigation: ({
        onDataLoad,
        onAdrLoad,
        onControlLoad,
        onInterfaceLoad,
        onCollapse,
    }: {
        onDataLoad: (data: unknown) => void;
        onAdrLoad: (adr: unknown) => void;
        onControlLoad: (control: unknown) => void;
        onInterfaceLoad: (iface: unknown) => void;
        onCollapse?: () => void;
    }) => (
        <div data-testid="tree-navigation">
            <div>Tree Navigation</div>
            {onCollapse && (
                <button aria-label="Collapse sidebar" onClick={onCollapse}>
                    Collapse
                </button>
            )}
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
            <button
                onClick={() =>
                    onControlLoad({
                        domain: 'test-domain',
                        controlId: 1,
                        controlName: 'test-control',
                        controlDescription: 'A test control',
                    })
                }
            >
                Load Test Control
            </button>
            <button
                onClick={() =>
                    onInterfaceLoad({
                        namespace: 'org.finos',
                        interfaceId: 1,
                        interfaceName: 'test-interface',
                        interfaceDescription: 'A test interface',
                    })
                }
            >
                Load Test Interface
            </button>
        </div>
    ),
}));

vi.mock('./components/tree-navigation/MobileNavMenu', () => ({
    MobileNavMenu: ({
        onDataLoad,
        onClose,
    }: {
        onDataLoad: (data: unknown) => void;
        onClose: () => void;
    }) => (
        <div data-testid="mobile-nav-menu">
            <button aria-label="Close navigation" onClick={onClose}>
                Close
            </button>
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
                Mobile Load Test Data
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

vi.mock('./components/control-detail-section/ControlDetailSection', () => ({
    ControlDetailSection: ({ controlData }: { controlData: { controlName?: string } }) => (
        <div data-testid="control-detail-section">Control: {controlData?.controlName}</div>
    ),
}));

vi.mock('./components/interface-detail-section/InterfaceDetailSection', () => ({
    InterfaceDetailSection: ({ interfaceData }: { interfaceData: { interfaceName?: string } }) => (
        <div data-testid="interface-detail-section">Interface: {interfaceData?.interfaceName}</div>
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

    it('renders ControlDetailSection when control data is loaded', () => {
        renderWithRouter(<Hub />);

        // Initially, control section should not be visible
        expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();

        // Click the Load Test Control button to simulate control loading
        fireEvent.click(screen.getByText('Load Test Control'));

        // Now ControlDetailSection should be visible
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.getByTestId('control-detail-section')).toHaveTextContent('Control: test-control');
    });

    it('switches between Control and other views correctly', () => {
        renderWithRouter(<Hub />);

        // Load control data
        fireEvent.click(screen.getByText('Load Test Control'));
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();

        // Switch to regular data (Pattern type renders DiagramSection)
        fireEvent.click(screen.getByText('Load Test Data'));
        expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

        // Switch back to control
        fireEvent.click(screen.getByText('Load Test Control'));
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
    });

    it('renders InterfaceDetailSection when interface data is loaded', () => {
        renderWithRouter(<Hub />);

        expect(screen.queryByTestId('interface-detail-section')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Load Test Interface'));

        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.getByTestId('interface-detail-section')).toHaveTextContent('Interface: test-interface');
    });

    it('switches between Interface and other views correctly', () => {
        renderWithRouter(<Hub />);

        // Load interface data
        fireEvent.click(screen.getByText('Load Test Interface'));
        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();

        // Switch to regular data
        fireEvent.click(screen.getByText('Load Test Data'));
        expect(screen.queryByTestId('interface-detail-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

        // Switch back to interface
        fireEvent.click(screen.getByText('Load Test Interface'));
        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
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

    describe('mobile layout', () => {
        afterEach(() => {
            // Restore the default desktop matchMedia mock from vitest.setup.ts.
            window.matchMedia = ((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
            })) as unknown as typeof window.matchMedia;
        });

        it('opens the drill-down panel immediately on mobile so the explorer is visible on landing', () => {
            const restore = mockMobileViewport(true);
            renderWithRouter(<Hub />);

            // On mobile the explorer opens straight away — the mobile equivalent of
            // the desktop tree being visible. The desktop tree is not rendered on mobile.
            expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
            expect(screen.queryByTestId('tree-navigation')).not.toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            restore();
        });

        it('closes the panel after a resource is loaded', () => {
            const restore = mockMobileViewport(true);
            renderWithRouter(<Hub />);

            fireEvent.click(screen.getByText('Mobile Load Test Data'));
            // Panel closes (aria-hidden again) but the menu remains mounted.
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            restore();
        });

        it('reopens the drill-down panel when the Explore button is clicked after closing', () => {
            const restore = mockMobileViewport(true);
            renderWithRouter(<Hub />);

            fireEvent.click(screen.getByText('Mobile Load Test Data'));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Explore'));
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            restore();
        });
    });

    describe('auth error clears content', () => {
        afterEach(() => {
            authStore.setAuthError(null);
        });

        it('clears displayed diagram content when a 403 is emitted', () => {
            renderWithRouter(<Hub />);
            fireEvent.click(screen.getByText('Load Test Data'));
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            act(() => {
                authStore.setAuthError(403);
            });

            expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        });

        it('clears displayed ADR content when a 401 is emitted', () => {
            renderWithRouter(<Hub />);
            fireEvent.click(screen.getByText('Load Test ADR'));
            expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();

            act(() => {
                authStore.setAuthError(401);
            });

            expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();
        });
    });
});
