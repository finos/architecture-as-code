import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import Hub from './Hub.js';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { authStore } from '../service/utils/auth-store.js';
import type { Data, Adr } from '../model/calm.js';
import type { ControlData } from '../model/control.js';
import type { InterfaceData } from '../model/interface.js';

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

// Capture the load callbacks Hub passes to the shared deep-link hook so tests can
// drive resource loading without a navigation surface owning those callbacks.
interface CapturedCallbacks {
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    onControlLoad: (control: ControlData) => void;
    onInterfaceLoad: (iface: InterfaceData) => void;
}
let captured: CapturedCallbacks | undefined;

vi.mock('./hooks/useResourceFromRoute', () => ({
    useResourceFromRoute: (opts: CapturedCallbacks) => {
        captured = opts;
    },
}));

vi.mock('./components/explore-rail/ExploreRail', () => ({
    ExploreRail: ({ onCollapse }: { onCollapse?: () => void }) => (
        <div data-testid="explore-rail">
            <div>Explore Rail</div>
            {onCollapse && (
                <button aria-label="Collapse sidebar" onClick={onCollapse}>
                    Collapse
                </button>
            )}
        </div>
    ),
}));

vi.mock('./components/tree-navigation/MobileNavMenu', () => ({
    MobileNavMenu: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="mobile-nav-menu">
            <button aria-label="Close navigation" onClick={onClose}>
                Close
            </button>
        </div>
    ),
}));

vi.mock('./components/namespace-page/NamespacePage', () => ({
    NamespacePage: ({ namespace, counts }: { namespace: string; counts?: { total: number } }) => (
        <div data-testid="namespace-page">
            Namespace: {namespace} ({counts?.total ?? 'loading'})
        </div>
    ),
}));

vi.mock('./components/domain-page/DomainPage', () => ({
    DomainPage: ({ domain, controlCount }: { domain: string; controlCount: number }) => (
        <div data-testid="domain-page">
            Domain: {domain} ({controlCount})
        </div>
    ),
}));

// Mocked at the seam: the real landing fires a bounded CalmService fetch on mount,
// which is exercised in its own spec. Here we only need to confirm Hub renders it
// on the empty `/` route.
vi.mock('./components/first-run-landing/FirstRunLanding', () => ({
    FirstRunLanding: ({ namespaceCounts }: { namespaceCounts: { namespace: string }[] }) => (
        <div data-testid="first-run-landing">Landing ({namespaceCounts.length})</div>
    ),
}));

// Counts service returns deterministic data for the page meta assertions.
vi.mock('../service/counts-service', () => ({
    CountsService: class {
        fetchNamespaceCounts() {
            return Promise.resolve([
                { namespace: 'finos', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 },
            ]);
        }
        fetchDomainCounts() {
            return Promise.resolve([{ domain: 'security', controlCount: 3 }]);
        }
    },
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

// Helpers to drive the captured load callbacks.
const loadData = () =>
    act(() => {
        captured?.onDataLoad({
            id: 'test',
            version: '1.0',
            calmType: 'Patterns',
            name: 'test-namespace',
            data: {},
        } as Data);
    });
const loadAdr = () => act(() => captured?.onAdrLoad({ id: 'test-adr' } as unknown as Adr));
const loadControl = () =>
    act(() =>
        captured?.onControlLoad({
            domain: 'test-domain',
            controlId: 1,
            controlName: 'test-control',
            controlDescription: 'A test control',
        })
    );
const loadInterface = () =>
    act(() =>
        captured?.onInterfaceLoad({
            namespace: 'org.finos',
            interfaceId: 1,
            interfaceName: 'test-interface',
            interfaceDescription: 'A test interface',
        })
    );

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Hub />
        </MemoryRouter>
    );

// A tiny in-router harness so tests can drive real react-router navigation
// (changing location.key) against the same <Hub/> instance — `rerender` with a
// fresh MemoryRouter would remount Hub and discard its state, defeating the test.
function NavHarness({ to }: { to: string }) {
    const navigate = useNavigate();
    return (
        <button data-testid={`nav-${to}`} onClick={() => navigate(to)}>
            go {to}
        </button>
    );
}

const renderWithNav = (path: string, targets: string[]) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Hub />
            {targets.map((t) => (
                <NavHarness key={t} to={t} />
            ))}
        </MemoryRouter>
    );

const navigateTo = (to: string) => fireEvent.click(screen.getByTestId(`nav-${to}`));

describe('Hub', () => {
    beforeEach(() => {
        captured = undefined;
    });

    it('renders Navbar and the browse rail', () => {
        renderAt('/');
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
        expect(screen.getByText('Explore Rail')).toBeInTheDocument();
    });

    it('renders DiagramSection when pattern data is loaded', () => {
        renderAt('/');
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        loadData();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toHaveTextContent('Diagram: test');
    });

    it('renders AdrRenderer when ADR data is loaded', () => {
        renderAt('/');
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();
        loadAdr();
        expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();
        expect(screen.getByTestId('adr-renderer')).toHaveTextContent('ADR: test-adr');
    });

    it('switches between DiagramSection and AdrRenderer correctly', () => {
        renderAt('/');
        loadData();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();

        loadAdr();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();

        loadData();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();
    });

    it('renders ControlDetailSection when control data is loaded', () => {
        renderAt('/');
        expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
        loadControl();
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.getByTestId('control-detail-section')).toHaveTextContent('Control: test-control');
    });

    it('switches between Control and other views correctly', () => {
        renderAt('/');
        loadControl();
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();

        loadData();
        expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

        loadControl();
        expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
    });

    it('renders InterfaceDetailSection when interface data is loaded', () => {
        renderAt('/');
        expect(screen.queryByTestId('interface-detail-section')).not.toBeInTheDocument();
        loadInterface();
        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.getByTestId('interface-detail-section')).toHaveTextContent('Interface: test-interface');
    });

    it('switches between Interface and other views correctly', () => {
        renderAt('/');
        loadInterface();
        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();

        loadData();
        expect(screen.queryByTestId('interface-detail-section')).not.toBeInTheDocument();
        expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

        loadInterface();
        expect(screen.getByTestId('interface-detail-section')).toBeInTheDocument();
        expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
    });

    describe('route-driven pages', () => {
        it('renders NamespacePage with the total from counts on /namespace/:ns', async () => {
            renderAt('/namespace/finos');
            expect(await screen.findByTestId('namespace-page')).toHaveTextContent('Namespace: finos (1)');
        });

        it('renders DomainPage with the control count from counts on /domain/:domain', async () => {
            renderAt('/domain/security');
            expect(await screen.findByTestId('domain-page')).toHaveTextContent('Domain: security (3)');
        });

        it('renders the first-run landing (not a namespace/domain page) on the empty / route', async () => {
            renderAt('/');
            expect(screen.queryByTestId('namespace-page')).not.toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();
            // Landing receives the namespace counts Hub fetched (one in the mock).
            expect(await screen.findByTestId('first-run-landing')).toHaveTextContent('Landing (1)');
        });
    });

    // Exercises the real route-driven content selection in Hub: the stale-clearing
    // layout effect (keyed on location.key) and the in-place-precedence ternary.
    // The page components stay mocked at their seam, but Hub's routing/clearing
    // logic runs for real via genuine react-router navigation.
    describe('route-driven content selection (clearing + in-place precedence)', () => {
        it('clears stale detail content when navigating from a detail route to a namespace page', async () => {
            // Start on a detail route with a resource loaded (deep-link style).
            renderWithNav('/finos/architectures/test/1.0', ['/namespace/finos']);
            loadData();
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            // Navigate to /namespace/finos — the stale detail must be cleared and the
            // NamespacePage shown instead.
            navigateTo('/namespace/finos');
            expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
            expect(await screen.findByTestId('namespace-page')).toHaveTextContent('Namespace: finos (1)');
        });

        it('shows an in-place control load on a domain page and keeps it across a no-nav re-render', () => {
            renderAt('/domain/security');
            // Before selecting a control, the domain page (control list) shows.
            expect(screen.getByTestId('domain-page')).toBeInTheDocument();

            // Selecting a control loads it in place (no navigation) — control detail shows.
            loadControl();
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();

            // A re-render that does NOT navigate (e.g. collapsing the sidebar) must not
            // clear the in-place control — location.key is unchanged.
            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();
        });

        it('returns to the domain control list when re-navigating to the already-active domain (B2)', () => {
            // In-place control loaded on the domain page (the navigation dead-end case).
            renderWithNav('/domain/security', ['/domain/security']);
            loadControl();
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();

            // Re-navigating to the SAME domain route changes location.key (verified
            // empirically for react-router 7), so the in-place control is cleared and
            // the control list (DomainPage) is shown again.
            navigateTo('/domain/security');
            expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
            expect(screen.getByTestId('domain-page')).toBeInTheDocument();
        });
    });

    describe('sidebar collapse', () => {
        it('shows sidebar expanded by default with collapse button', () => {
            renderAt('/');
            expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
            expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
        });

        it('hides the rail when sidebar is collapsed', () => {
            renderAt('/');
            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
        });

        it('restores the rail when sidebar is expanded again', () => {
            renderAt('/');
            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('Expand sidebar'));
            expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
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

        it('opens the drill-down panel immediately on mobile and does not render the desktop rail', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');

            expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            restore();
        });

        it('closes the panel after a resource is loaded', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');

            loadData();
            // Panel closes (aria-hidden again) but the menu remains mounted.
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            restore();
        });

        it('reopens the drill-down panel when the Explore button is clicked after closing', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');

            loadData();
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
            renderAt('/');
            loadData();
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            act(() => {
                authStore.setAuthError(403);
            });

            expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        });

        it('clears displayed ADR content when a 401 is emitted', () => {
            renderAt('/');
            loadAdr();
            expect(screen.getByTestId('adr-renderer')).toBeInTheDocument();

            act(() => {
                authStore.setAuthError(401);
            });

            expect(screen.queryByTestId('adr-renderer')).not.toBeInTheDocument();
        });
    });
});
