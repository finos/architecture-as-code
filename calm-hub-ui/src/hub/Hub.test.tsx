import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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

// Mocked at the seam: the real intro fires a bounded CalmService fetch on mount and
// carries its own theme/search wiring, exercised in its own spec. Here we only need
// to confirm Hub early-returns the chrome-free intro on the empty `/` route.
vi.mock('./components/intro-screen/IntroScreen', () => ({
    IntroScreen: ({ namespaceCounts }: { namespaceCounts: { namespace: string }[] }) => (
        <div data-testid="intro-screen">Intro ({namespaceCounts.length})</div>
    ),
}));

// The full results page is reached on `/search`; mocked here so Hub tests never hit
// the real SearchService.
vi.mock('./components/search-results/SearchResultsPage', () => ({
    SearchResultsPage: () => <div data-testid="search-results-page">Search Results</div>,
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
    JsonRenderer: ({ json }: { json: unknown }) => <div data-testid="json-renderer">{json ? 'JSON' : ''}</div>,
}));

vi.mock('./components/adr-renderer/AdrRenderer', () => ({
    AdrRenderer: ({ adrDetails }: { adrDetails: { id?: string } }) => <div data-testid="adr-renderer">ADR: {adrDetails?.id}</div>,
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

vi.mock('./components/diagram-section/DiagramSection', async () => {
    // Real context, not a mock: the stub consumes Hub's provider exactly like the
    // production tree (CustomNode / NodeDetails) does.
    const { useDiagramActions } = await import('../visualizer/context/DiagramActionsContext.js');
    const DiagramSection = ({
        data,
        onItemSelect,
        breadcrumbs,
        onDisplayNameChange,
    }: {
        data: { id?: string };
        onItemSelect?: (item: { data: unknown }) => void;
        breadcrumbs?: unknown[];
        onDisplayNameChange?: (name: string | undefined) => void;
    }) => {
        const { onNavigateToDetailedArch } = useDiagramActions();
        return (
        <div data-testid="diagram-section">
            Diagram: {data?.id}
            {/* Trail from history state, echoed for breadcrumb-accumulation tests. */}
            <div data-testid="breadcrumbs">{JSON.stringify(breadcrumbs ?? [])}</div>
            {/* Simulates the summaries fetch resolving the display name. */}
            <button data-testid="set-display-name" onClick={() => onDisplayNameChange?.('Nice Name')}>
                set display name
            </button>
            {/* Simulates a node's "Explore Architecture" action (context consumer). */}
            <button
                data-testid="navigate-detailed-arch"
                onClick={() => onNavigateToDetailedArch?.('/calm/namespaces/finos/architectures/target-arch/versions/2.0.0')}
            >
                navigate detailed
            </button>
            <button
                data-testid="navigate-detailed-arch-bad"
                onClick={() => onNavigateToDetailedArch?.('/not/a/calm/path')}
            >
                navigate bad
            </button>
            {/* Lets tests simulate a node/edge tap on the graph so Hub's node-detail
                wiring (the mobile bottom-sheet + prev/next steppers) is exercised.
                `select-node` (n1) is retained for existing tests; `select-n1/n2/n3`
                let a test pick a specific node (the ids/names match the architecture
                nodes loaded by `loadArchitectureWithNodes`, so Hub's index resolution
                and the displayed node name line up). `select-edge` selects a
                relationship (no `node-type`) to exercise the node-only degradation. */}
            <button
                data-testid="select-node"
                onClick={() =>
                    onItemSelect?.({
                        data: { 'unique-id': 'n1', name: 'Node One', 'node-type': 'service' },
                    })
                }
            >
                select node
            </button>
            <button
                data-testid="select-n1"
                onClick={() =>
                    onItemSelect?.({
                        data: { 'unique-id': 'n1', name: 'Node One', 'node-type': 'service' },
                    })
                }
            >
                select n1
            </button>
            <button
                data-testid="select-n2"
                onClick={() =>
                    onItemSelect?.({
                        data: { 'unique-id': 'n2', name: 'Node Two', 'node-type': 'service' },
                    })
                }
            >
                select n2
            </button>
            <button
                data-testid="select-n3"
                onClick={() =>
                    onItemSelect?.({
                        data: { 'unique-id': 'n3', name: 'Node Three', 'node-type': 'service' },
                    })
                }
            >
                select n3
            </button>
            <button
                data-testid="select-edge"
                onClick={() =>
                    onItemSelect?.({
                        data: {
                            'unique-id': 'r1',
                            description: 'Edge One',
                            'relationship-type': { connects: { source: { node: 'n1' }, destination: { node: 'n2' } } },
                        },
                    })
                }
            >
                select edge
            </button>
        </div>
        );
    };
    return { DiagramSection };
});

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

// Architecture load whose `data.nodes` is a flat array (the shape Hub reads for
// the mobile node steppers). Ids/names match the DiagramSection mock's
// select-n1/n2/n3 buttons so stepping resolves to the JSON-adjacent neighbour.
const loadArchitectureWithNodes = () =>
    act(() => {
        captured?.onDataLoad({
            id: 'arch',
            version: '1.0',
            calmType: 'Architectures',
            name: 'test-namespace',
            data: {
                nodes: [
                    { 'unique-id': 'n1', name: 'Node One', 'node-type': 'service' },
                    { 'unique-id': 'n2', name: 'Node Two', 'node-type': 'service' },
                    { 'unique-id': 'n3', name: 'Node Three', 'node-type': 'service' },
                ],
            },
        } as unknown as Data);
    });

// Pattern load whose nodes are nested under `properties.nodes` — so `data.data.nodes`
// is NOT a flat array and the steppers must degrade (resolve to disabled).
const loadPatternWithNestedNodes = () =>
    act(() => {
        captured?.onDataLoad({
            id: 'pat',
            version: '1.0',
            calmType: 'Patterns',
            name: 'test-namespace',
            data: {
                properties: {
                    nodes: [
                        { 'unique-id': 'n1', name: 'Node One', 'node-type': 'service' },
                        { 'unique-id': 'n2', name: 'Node Two', 'node-type': 'service' },
                    ],
                },
            },
        } as unknown as Data);
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

// Echoes the live pathname so tests can assert where a context-triggered
// navigation landed. Accepts entry objects so a test can seed history state.
function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-pathname">{location.pathname}</div>;
}

const renderWithLocation = (entries: React.ComponentProps<typeof MemoryRouter>['initialEntries']) =>
    render(
        <MemoryRouter initialEntries={entries}>
            <Hub />
            <LocationProbe />
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

    it('renders Navbar and the browse rail on a browse route', () => {
        // The bare `/` intro is chrome-free; the navbar + rail appear on every other
        // route (here a namespace page).
        renderAt('/namespace/finos');
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
        expect(screen.getByText('Explore Rail')).toBeInTheDocument();
    });

    it('renders the chrome-free intro (no navbar, no rail) on the empty / route', () => {
        renderAt('/');
        expect(screen.getByTestId('intro-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
        expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
    });

    it('renders the full search results page (with chrome) on /search', () => {
        renderAt('/search?q=payments');
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
        expect(screen.getByTestId('search-results-page')).toBeInTheDocument();
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

        it('renders the intro (not a namespace/domain page) on the empty / route', async () => {
            renderAt('/');
            expect(screen.queryByTestId('namespace-page')).not.toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();
            // Intro receives the namespace counts Hub fetched (one in the mock).
            expect(await screen.findByTestId('intro-screen')).toHaveTextContent('Intro (1)');
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

        it('replaces the domain grid with the full-pane control view and keeps it across a no-nav re-render', () => {
            renderAt('/domain/security');
            // Before selecting a control, the domain page (card grid) shows.
            expect(screen.getByTestId('domain-page')).toBeInTheDocument();

            // Selecting a control fills the whole content pane (like an architecture
            // or document detail view) — the grid is replaced, not kept behind.
            loadControl();
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();

            // A re-render that does NOT navigate (e.g. collapsing the sidebar) must not
            // clear the control — location.key is unchanged.
            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
        });

        it('returns to the domain control list via the breadcrumb', () => {
            renderAt('/domain/security');
            loadControl(); // domain: 'test-domain'
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();

            // The domain breadcrumb navigates back to that domain's control list.
            fireEvent.click(screen.getByRole('link', { name: 'test-domain' }));
            expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
            expect(screen.getByTestId('domain-page')).toHaveTextContent('Domain: test-domain');
        });

        it('fills the pane on the control detail route and returns to the grid via the breadcrumb', () => {
            // A control reached via the detail route (deep-link / mobile drill-down)
            // fills the content pane; the breadcrumb lands back on the grid.
            renderWithNav('/test-domain/controls/1/detail', []);
            loadControl(); // domain: 'test-domain'
            expect(screen.getByTestId('control-detail-section')).toBeInTheDocument();
            expect(screen.queryByTestId('domain-page')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('link', { name: 'test-domain' }));
            expect(screen.queryByTestId('control-detail-section')).not.toBeInTheDocument();
            expect(screen.getByTestId('domain-page')).toHaveTextContent('Domain: test-domain');
        });

        it('renders the control view full-pane on mobile, with no takeover dialog', () => {
            const restore = mockMobileViewport(true);
            try {
                renderAt('/domain/security');
                loadControl();
                const view = screen.getByTestId('control-detail-section');
                expect(view).toBeInTheDocument();
                // It fills the normal content pane rather than an overlay dialog.
                expect(view.closest('[role="dialog"]')).toBeNull();
            } finally {
                restore();
            }
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

    // The rail lives in Hub's normal (non-intro) layout, so these exercise it on a
    // browse route rather than the chrome-free `/` intro.
    describe('sidebar collapse', () => {
        it('shows sidebar expanded by default with collapse button', () => {
            renderAt('/namespace/finos');
            expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
            expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
        });

        it('hides the rail when sidebar is collapsed', () => {
            renderAt('/namespace/finos');
            fireEvent.click(screen.getByLabelText('Collapse sidebar'));
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
        });

        it('restores the rail when sidebar is expanded again', () => {
            renderAt('/namespace/finos');
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

        it('shows the chrome-free intro on mobile / (no drill-down, no rail)', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');

            expect(screen.getByTestId('intro-screen')).toBeInTheDocument();
            expect(screen.queryByTestId('mobile-nav-menu')).not.toBeInTheDocument();
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            restore();
        });

        it('opens the drill-down panel immediately on a mobile browse route and does not render the desktop rail', () => {
            const restore = mockMobileViewport(true);
            renderAt('/namespace/finos');

            expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            restore();
        });

        it('shows the search results on mobile /search, not the drill-down overlay', () => {
            // The overlay defaults open; on /search it must be closed so the results
            // (the only mobile search destination) are visible, not covered.
            const restore = mockMobileViewport(true);
            renderAt('/search?q=payments');

            expect(screen.getByTestId('search-results-page')).toBeInTheDocument();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

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

        it('raises the node bottom-sheet (not a full-screen takeover) when a node is selected (Frame G)', () => {
            const restore = mockMobileViewport(true);
            const { container } = renderAt('/');

            loadData();
            fireEvent.click(screen.getByTestId('select-node'));

            // The mobile node detail is now the bottom-sheet, and the old
            // full-screen slide-in takeover is gone.
            expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
            expect(screen.getByText('Node One')).toBeInTheDocument();
            expect(container.querySelector('.animate-slide-in-right')).toBeNull();

            restore();
        });

        it('closes the bottom-sheet when its close button is tapped', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');

            loadData();
            fireEvent.click(screen.getByTestId('select-node'));
            expect(screen.getByTestId('node-sheet')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /close details/i }));
            expect(screen.queryByTestId('node-sheet')).not.toBeInTheDocument();

            restore();
        });

        // Frame-G integration: the real prev/next stepper wiring Hub derives from
        // `data.data.nodes`. These drive the REAL NodeSheet steppers (Hub does not
        // mock NodeSheet), so they exercise diagramNodes / selectedNodeIndex /
        // onPrevNode / onNextNode end-to-end. The displayed node name comes from the
        // real NodeDetails, so it tracks the architecture array as we step.
        describe('node bottom-sheet prev/next steppers (Frame G)', () => {
            const prevBtn = () => screen.getByRole('button', { name: /previous node/i });
            const nextBtn = () => screen.getByRole('button', { name: /next node/i });

            it('walks the architecture node list from the middle: both steppers work, and clamps at the ends', () => {
                const restore = mockMobileViewport(true);
                renderAt('/');

                loadArchitectureWithNodes();
                // Select the MIDDLE node (n2) — both neighbours exist.
                fireEvent.click(screen.getByTestId('select-n2'));
                expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
                expect(screen.getByText('Node Two')).toBeInTheDocument();
                expect(prevBtn()).toBeEnabled();
                expect(nextBtn()).toBeEnabled();

                // Next moves to the JSON-adjacent next node (n3), the LAST node, where
                // next clamps (disabled) and prev still works.
                fireEvent.click(nextBtn());
                expect(screen.getByText('Node Three')).toBeInTheDocument();
                expect(nextBtn()).toBeDisabled();
                expect(prevBtn()).toBeEnabled();

                // Prev walks back n3 -> n2 -> n1 (the FIRST node), where prev clamps
                // (disabled) and next still works.
                fireEvent.click(prevBtn());
                expect(screen.getByText('Node Two')).toBeInTheDocument();
                fireEvent.click(prevBtn());
                expect(screen.getByText('Node One')).toBeInTheDocument();
                expect(prevBtn()).toBeDisabled();
                expect(nextBtn()).toBeEnabled();

                restore();
            });

            it('degrades cleanly for a pattern (nodes nested under properties.nodes): steppers present but disabled', () => {
                const restore = mockMobileViewport(true);
                renderAt('/');

                // A selected node still raises the sheet, but `data.data.nodes` is not
                // a flat array for a pattern, so diagramNodes is empty and both
                // neighbours resolve to undefined — present-but-disabled, not crashing.
                loadPatternWithNestedNodes();
                fireEvent.click(screen.getByTestId('select-n1'));
                expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
                expect(prevBtn()).toBeDisabled();
                expect(nextBtn()).toBeDisabled();

                restore();
            });

            it('renders no steppers when an edge (no node-type) is selected', () => {
                const restore = mockMobileViewport(true);
                renderAt('/');

                // An edge has no place in the node list and is not a node, so the
                // steppers are not rendered at all (node-only affordance).
                loadArchitectureWithNodes();
                fireEvent.click(screen.getByTestId('select-edge'));
                expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /previous node/i })).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: /next node/i })).not.toBeInTheDocument();

                restore();
            });
        });
    });

    it('renders the inline Sidebar drawer (not the bottom-sheet) on desktop when a node is selected', () => {
        // Desktop default matchMedia (matches:false) — the node detail must stay the
        // inline desktop drawer, never the mobile NodeSheet.
        renderAt('/');
        loadData();
        fireEvent.click(screen.getByTestId('select-node'));
        expect(screen.queryByTestId('node-sheet')).not.toBeInTheDocument();
        // The desktop Sidebar renders the node title in its drawer.
        expect(screen.getByText('Node One')).toBeInTheDocument();
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
    describe('detailed-architecture navigation (breadcrumb state)', () => {
        const readCrumbs = () => JSON.parse(screen.getByTestId('breadcrumbs').textContent!);

        it('pushes the current resource as a named crumb and navigates to the parsed target', () => {
            renderWithLocation(['/test-namespace/architectures/arch/1.0']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('set-display-name'));

            fireEvent.click(screen.getByTestId('navigate-detailed-arch'));

            expect(screen.getByTestId('location-pathname')).toHaveTextContent(
                '/finos/architectures/target-arch/2.0.0'
            );
            // The new route's resource loads; the remounted diagram receives the trail.
            loadArchitectureWithNodes();
            expect(readCrumbs()).toEqual([
                { namespace: 'test-namespace', type: 'architectures', id: 'arch', version: '1.0', name: 'Nice Name' },
            ]);
        });

        it('accumulates one crumb per hop and omits the name when it never resolved', () => {
            renderWithLocation(['/test-namespace/architectures/arch/1.0']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('navigate-detailed-arch'));
            loadArchitectureWithNodes();
            expect(readCrumbs()).toHaveLength(1);

            fireEvent.click(screen.getByTestId('navigate-detailed-arch'));
            loadArchitectureWithNodes();

            const crumbs = readCrumbs();
            expect(crumbs).toHaveLength(2);
            // No set-display-name click before either hop's navigation: the crumb
            // carries no name and consumers fall back to the id.
            expect(crumbs[0].name).toBeUndefined();
            expect(crumbs[1]).toEqual({ namespace: 'test-namespace', type: 'architectures', id: 'arch', version: '1.0' });
        });

        it('routes references that are not CALM Hub paths to the in-app not-found view', () => {
            renderWithLocation(['/test-namespace/architectures/arch/1.0']);
            loadArchitectureWithNodes();

            fireEvent.click(screen.getByTestId('navigate-detailed-arch-bad'));

            // A malformed ref must never leave the app (no new tab onto the
            // backend's raw 404): it lands on the broken-reference route, which
            // echoes the raw ref and offers a way back via the pushed crumb.
            expect(screen.getByTestId('location-pathname')).toHaveTextContent('/broken-reference');
            expect(screen.getByText('Resource not found')).toBeInTheDocument();
            expect(screen.getByText('/not/a/calm/path')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Back to arch' })).toBeInTheDocument();
        });

        it('filters malformed entries out of untrusted history state', () => {
            const valid = { namespace: 'finos', type: 'architectures', id: 'parent', version: '1.0.0' };
            renderWithLocation([
                {
                    pathname: '/test-namespace/architectures/arch/1.0',
                    state: { breadcrumbs: [valid, { junk: true }, 'nonsense', null, { namespace: 'x', type: 'flows', id: 'y', version: '1' }] },
                },
            ]);
            loadArchitectureWithNodes();

            expect(readCrumbs()).toEqual([valid]);
        });
    });

});
