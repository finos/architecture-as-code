import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { HashRouter, Link, MemoryRouter, Route, Routes, UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import Hub from './Hub.js';
import { vi, describe, it, expect, afterEach, beforeEach, type MockInstance } from 'vitest';
import { authStore } from '../service/utils/auth-store.js';
import { CountsService } from '../service/counts-service.js';
import { PersonalNamespaceService } from '../service/personal-namespace-service.js';
import type { Data, Adr } from '../model/calm.js';
import type { ExtensionSummary } from '../model/extensions.js';
import { ExtensionsContext } from '../extensions/ExtensionsContext.js';
import { UiConfigContext } from '../components/ui-config/UiConfigContext.js';
import type { UiNavigation } from '../model/ui-config.js';
import { ExtensionService } from '../service/extension-service.js';
import { fakeExtension } from '../test-support/fake-extensions.js';
import type { ControlData } from '../model/control.js';
import type { InterfaceData } from '../model/interface.js';
import { ReturnLink } from '../navigation/ReturnLink.js';
import { createMemoryStorage } from '../test-support/memory-storage.js';
import { INSPECTOR_ID } from './components/inspector/inspectorIds.js';

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

/** A viewport that can cross the 1024px breakpoint, as a rotated tablet does. Only the width query matches. */
function resizableViewport(narrow: boolean) {
    const original = window.matchMedia;
    const listeners = new Set<() => void>();
    let current = narrow;
    window.matchMedia = ((query: string) => ({
        get matches() {
            return query.includes('max-width') && current;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
        addListener: (listener: () => void) => listeners.add(listener),
        removeListener: (listener: () => void) => listeners.delete(listener),
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    return {
        set(next: boolean) {
            current = next;
            act(() => listeners.forEach((listener) => listener()));
        },
        restore() {
            window.matchMedia = original;
        },
    };
}

/**
 * jsdom has no top layer. This models what a browser does with modal dialogs: showModal puts a dialog on top, and it
 * throws on an open dialog. A removal from the page, also as part of a move, ends the modal state, and the dialog stays
 * open. While a dialog is modal, focus() outside the top one does nothing, and Escape cancels the top one.
 */
function modelTopLayer() {
    // The modal dialogs, in top layer order.
    const shown = new Set<HTMLDialogElement>();
    const top = () => [...shown].at(-1);
    const removes = (node: Node) => {
        if (node.isConnected) shown.forEach((dialog) => node.contains(dialog) && shown.delete(dialog));
    };
    const { appendChild, insertBefore, removeChild } = Node.prototype;
    const moves = [
        vi.spyOn(Node.prototype, 'appendChild').mockImplementation(function <T extends Node>(this: Node, node: T) {
            removes(node);
            return appendChild.call(this, node) as T;
        }),
        vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function <T extends Node>(this: Node, node: T, child: Node | null) {
            removes(node);
            return insertBefore.call(this, node, child) as T;
        }),
        vi.spyOn(Node.prototype, 'removeChild').mockImplementation(function <T extends Node>(this: Node, child: T) {
            removes(child);
            return removeChild.call(this, child) as T;
        }),
    ];
    const { matches } = Element.prototype;
    const focus = HTMLElement.prototype.focus;
    Object.defineProperties(HTMLDialogElement.prototype, {
        showModal: {
            configurable: true,
            value(this: HTMLDialogElement) {
                if (this.open) throw new DOMException('The dialog is open.', 'InvalidStateError');
                this.setAttribute('open', '');
                shown.add(this);
            },
        },
        close: {
            configurable: true,
            value(this: HTMLDialogElement) {
                this.removeAttribute('open');
                shown.delete(this);
            },
        },
        matches: {
            configurable: true,
            value(this: HTMLDialogElement, selector: string) {
                return selector === ':modal' ? shown.has(this) : matches.call(this, selector);
            },
        },
    });
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
        const modal = top();
        if (modal && !modal.contains(this)) return;
        focus.call(this, options);
    });
    return {
        top,
        escape() {
            const modal = top();
            if (modal && fireEvent(modal, new Event('cancel', { cancelable: true }))) modal.close();
        },
        restore() {
            for (const name of ['showModal', 'close', 'matches']) delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[name];
            focusSpy.mockRestore();
            moves.forEach((move) => move.mockRestore());
        },
    };
}

// Capture the load callbacks Hub passes to the shared deep-link hook so tests can
// drive resource loading without a navigation surface owning those callbacks.
interface CapturedCallbacks {
    onDataLoad: (data: Data) => void;
    onAdrLoad: (adr: Adr) => void;
    onControlLoad: (control: ControlData) => void;
    onInterfaceLoad: (iface: InterfaceData) => void;
    onLoadError?: (error: unknown) => void;
    resourceKey: string;
}
let captured: CapturedCallbacks | undefined;
// The click handler that Hub gives the diagram. The diagram lays out its nodes again when it changes.
let diagramItemSelect: unknown;

vi.mock('./hooks/useResourceFromRoute', () => ({
    useResourceFromRoute: (opts: CapturedCallbacks) => {
        captured = opts;
    },
}));

vi.mock('./components/explore-rail/ExploreRail', () => ({
    ExploreRail: ({ onCollapse, namespacesFailed }: { onCollapse?: () => void; namespacesFailed?: boolean }) => (
        <div data-testid="explore-rail">
            <div>Explore Rail</div>
            <div data-testid="rail-namespaces-failed">{String(Boolean(namespacesFailed))}</div>
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
    IntroScreen: ({
        namespaceCounts,
        personalNamespace,
    }: {
        namespaceCounts: { namespace: string }[];
        personalNamespace?: { create: () => Promise<boolean> };
    }) => (
        <div data-testid="intro-screen">
            Intro ({namespaceCounts.length})
            <button onClick={() => void personalNamespace?.create()}>create-personal</button>
        </div>
    ),
}));

// The full results page is reached on `/search`; mocked here so Hub tests never hit
// the real SearchService.
vi.mock('./components/search-results/SearchResultsPage', () => ({
    SearchResultsPage: () => <div data-testid="search-results-page">Search Results</div>,
}));

// Personal namespaces are off by default, so the hook sees the feature as unavailable.
vi.mock('../service/personal-namespace-service', () => ({
    PersonalNamespaceService: class {
        fetchPersonalNamespace() {
            return Promise.resolve({ status: 'unavailable' });
        }
        createPersonalNamespace() {
            return Promise.resolve({ status: 'unavailable' });
        }
    },
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
    const { DestinationLink } = await import('../navigation/DestinationLink.js');
    const { useEffect } = await import('react');
    const DiagramSection = ({
        data,
        onItemSelect,
        breadcrumbs,
        onDisplayNameChange,
        onDecoratorsChange,
        onDroppedFileChange,
        inspector,
    }: {
        data: { id?: string };
        onItemSelect?: (item: { data: unknown }) => void;
        breadcrumbs?: unknown[];
        onDisplayNameChange?: (name: string | undefined) => void;
        onDecoratorsChange?: (decorators: unknown[]) => void;
        onDroppedFileChange?: (dropped: boolean) => void;
        inspector?: { open: boolean; controls: string; onToggle: () => void };
    }) => {
        const { onNavigateToDetailedArch } = useDiagramActions();
        useEffect(() => {
            diagramItemSelect = onItemSelect;
        });
        return (
        <div data-testid="diagram-section">
            Diagram: {data?.id}
            {inspector && (
                <button type="button" hidden={inspector.open} aria-expanded={inspector.open} aria-controls={inspector.controls} onClick={inspector.onToggle}>
                    Details & extensions
                </button>
            )}
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
            {/* An extension link from the resource page, such as a designer tab sends. */}
            <DestinationLink destination={{ screen: { extension: 'assurance', screen: 'reviews' } }}>Open reviews</DestinationLink>
            <button data-testid="drop-file" onClick={() => onDroppedFileChange?.(true)}>
                drop file
            </button>
            <button data-testid="lose-dropped-file" onClick={() => onDroppedFileChange?.(false)}>
                lose dropped file
            </button>
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
            {/* Simulates the decorators fetch resolving. */}
            <button
                data-testid="report-decorators"
                onClick={() =>
                    onDecoratorsChange?.([
                        { uniqueId: 'obs-n1', type: 'observability', target: [], appliesTo: ['n1'], data: { owner: 'team-a' } },
                        { uniqueId: 'obs-n2', type: 'observability', target: [], appliesTo: ['n2'], data: { owner: 'team-b' } },
                    ])
                }
            >
                report decorators
            </button>
            {/* A decorator on a containment relationship, which its container lists. */}
            <button
                data-testid="report-containment-decorator"
                onClick={() =>
                    onDecoratorsChange?.([
                        { uniqueId: 'obs-deploy', type: 'observability', target: [], appliesTo: ['n1-in-cluster'], data: {} },
                    ])
                }
            >
                report containment decorator
            </button>
            <button
                data-testid="select-cluster"
                onClick={() =>
                    onItemSelect?.({ data: { 'unique-id': 'cluster', name: 'Cluster', 'node-type': 'system' } })
                }
            >
                select cluster
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

/** The history of the mounted LocationProbe's router, and the key of the location that the router shows. */
const routerView: { history: { location: { key: string } } | null; shownKey: string } = { history: null, shownKey: '' };

// Echoes the live pathname so tests can assert where a context-triggered
// navigation landed. Accepts entry objects so a test can seed history state.
function LocationProbe() {
    const location = useLocation();
    // A MemoryRouter's navigator is its memory history, which has the location of each navigation at once.
    const { navigator } = React.useContext(UNSAFE_NavigationContext);
    React.useLayoutEffect(() => {
        routerView.history = navigator as unknown as typeof routerView.history;
        routerView.shownKey = location.key;
        return () => {
            routerView.history = null;
        };
    });
    return (
        <>
            <div data-testid="location-pathname">{location.pathname}</div>
            <div data-testid="location-search">{location.search}</div>
        </>
    );
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

const renderWithNav = (path: string, targets: string[], extensions: ExtensionSummary[] = []) =>
    render(
        <ExtensionsContext.Provider value={extensions}>
            <MemoryRouter initialEntries={[path]}>
                <Hub />
                {targets.map((t) => (
                    <NavHarness key={t} to={t} />
                ))}
            </MemoryRouter>
        </ExtensionsContext.Provider>
    );

// An extension with a lens and its own view parameter, as the registry lists it.
const C4_EXTENSION = {
    id: 'c4', name: 'C4 model', hubApi: 0, routes: [],
    contributes: { 'diagram-lens': [{ id: 'c4', title: 'C4', route: 'lens', notation: 'notation.json', params: { level: { values: ['container'] } } }] },
} as unknown as ExtensionSummary;

// The selection bar above Details also names the selection.
const details = () => within(screen.getByRole('region', { name: 'Details' }));
const inspectorSelector = () => screen.getByRole('button', { name: /^Inspector view:/ });
const chooseInspectorView = (name: string) => {
    fireEvent.click(inspectorSelector());
    fireEvent.click(screen.getByRole('menuitemradio', { name }));
};

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

    describe('personal namespace', () => {
        const usersRoot = { namespace: 'users', architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 0 };
        const finos = { namespace: 'finos', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 };
        const bob = { namespace: 'users.bob', architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 0 };

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('hides the empty personal namespace root on the intro', async () => {
            vi.spyOn(PersonalNamespaceService.prototype, 'fetchPersonalNamespace').mockResolvedValue({ status: 'available', name: 'users.bob' });
            vi.spyOn(CountsService.prototype, 'fetchNamespaceCounts').mockResolvedValue([finos, usersRoot]);

            renderAt('/');

            await waitFor(() => expect(screen.getByTestId('intro-screen')).toHaveTextContent('Intro (1)'));
        });

        it('reloads the namespace counts after the personal namespace is created', async () => {
            vi.spyOn(PersonalNamespaceService.prototype, 'fetchPersonalNamespace').mockResolvedValue({ status: 'available', name: 'users.bob' });
            vi.spyOn(PersonalNamespaceService.prototype, 'createPersonalNamespace').mockResolvedValue({ status: 'owned', name: 'users.bob' });
            const fetchCounts = vi
                .spyOn(CountsService.prototype, 'fetchNamespaceCounts')
                .mockResolvedValueOnce([finos, usersRoot])
                .mockResolvedValueOnce([finos, usersRoot, bob]);

            renderAt('/');
            await waitFor(() => expect(screen.getByTestId('intro-screen')).toHaveTextContent('Intro (1)'));
            fireEvent.click(screen.getByText('create-personal'));

            await waitFor(() => expect(screen.getByTestId('intro-screen')).toHaveTextContent('Intro (3)'));
            expect(fetchCounts).toHaveBeenCalledTimes(2);
        });

        it('clears the counts failure when the reload after a create succeeds', async () => {
            vi.spyOn(PersonalNamespaceService.prototype, 'fetchPersonalNamespace').mockResolvedValue({ status: 'available', name: 'users.bob' });
            vi.spyOn(PersonalNamespaceService.prototype, 'createPersonalNamespace').mockResolvedValue({ status: 'owned', name: 'users.bob' });
            const fetchCounts = vi
                .spyOn(CountsService.prototype, 'fetchNamespaceCounts')
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValueOnce([finos, usersRoot, bob]);

            renderWithNav('/', ['/namespace/finos']);
            await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(1));
            fireEvent.click(screen.getByText('create-personal'));
            await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(2));
            navigateTo('/namespace/finos');

            await waitFor(() => expect(screen.getByTestId('rail-namespaces-failed')).toHaveTextContent('false'));
        });

        it('does not reload the counts when the name is taken', async () => {
            vi.spyOn(PersonalNamespaceService.prototype, 'fetchPersonalNamespace').mockResolvedValue({ status: 'available', name: 'users.bob' });
            vi.spyOn(PersonalNamespaceService.prototype, 'createPersonalNamespace').mockResolvedValue({ status: 'taken', name: 'users.bob' });
            const fetchCounts = vi.spyOn(CountsService.prototype, 'fetchNamespaceCounts').mockResolvedValue([finos]);

            renderAt('/');
            await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(1));
            fireEvent.click(screen.getByText('create-personal'));

            await waitFor(() => expect(PersonalNamespaceService.prototype.createPersonalNamespace).toHaveBeenCalled());
            expect(fetchCounts).toHaveBeenCalledTimes(1);
        });
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

        it('passes an unknown (undefined) control count, not a misleading 0, when the domain counts fetch fails', async () => {
            // A failed fetch means the count is unknown, not a confirmed zero —
            // the same distinction Hub already makes for namespace counts.
            vi.spyOn(CountsService.prototype, 'fetchDomainCounts').mockRejectedValueOnce(new Error('boom'));
            renderAt('/domain/security');
            expect(await screen.findByTestId('domain-page')).toHaveTextContent('Domain: security ()');
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
    describe('operator navigation settings', () => {
        const renderWithNavigation = (path: string, navigation: Partial<UiNavigation>) =>
            render(
                <UiConfigContext.Provider value={{ navigation: { layout: 'menu', showNamespaces: true, showControlDomains: true, ...navigation } }}>
                    <MemoryRouter initialEntries={[path]}>
                        <Hub />
                    </MemoryRouter>
                </UiConfigContext.Provider>
            );
        const hidden = { showNamespaces: false, showControlDomains: false };

        it('still opens a deep link to a namespace and a domain whose navigation is hidden', async () => {
            const { unmount } = renderWithNavigation('/namespace/finos', hidden);
            expect(await screen.findByTestId('namespace-page')).toHaveTextContent('Namespace: finos (1)');
            unmount();

            renderWithNavigation('/domain/security', hidden);
            expect(await screen.findByTestId('domain-page')).toHaveTextContent('Domain: security (3)');
        });

        it('has no explore rail when both of its sections are hidden, and keeps it for one', async () => {
            const { unmount } = renderWithNavigation('/namespace/finos', hidden);
            await screen.findByTestId('namespace-page');
            expect(screen.queryByTestId('explore-rail')).not.toBeInTheDocument();
            unmount();

            renderWithNavigation('/namespace/finos', { showControlDomains: false });
            expect(screen.getByTestId('explore-rail')).toBeInTheDocument();
        });

        it('does not open the mobile drill-down by itself when both of its sections are hidden', () => {
            const restore = mockMobileViewport(true);
            renderWithNavigation('/namespace/finos', hidden);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
            restore();
        });

        it('keeps the navbar on the home page in the sidebar layout', async () => {
            const { unmount } = renderWithNavigation('/', {});
            await screen.findByTestId('intro-screen');
            expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
            unmount();

            renderWithNavigation('/', { layout: 'sidebar' });
            expect(await screen.findByTestId('intro-screen')).toBeInTheDocument();
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
        });
    });

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

        it('keeps the loaded diagram when only the tab in the query changes', () => {
            renderWithNav('/finos/patterns/test/1.0', ['/finos/patterns/test/1.0?tab=json']);
            loadData();
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            navigateTo('/finos/patterns/test/1.0?tab=json');
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();

            // The same path and query again still clears it, so that the route loads it again.
            navigateTo('/finos/patterns/test/1.0?tab=json');
            expect(screen.queryByTestId('diagram-section')).not.toBeInTheDocument();
        });

        it('loads the resource again when only the query changes after the load failed', () => {
            renderWithNav('/finos/patterns/p/1.0.0?tab=used-by', ['/finos/patterns/p/1.0.0']);
            act(() => captured?.onLoadError?.(new Error('not found')));
            expect(screen.getByText('Pattern not found')).toBeInTheDocument();
            const failedKey = captured?.resourceKey;

            navigateTo('/finos/patterns/p/1.0.0');

            expect(captured?.resourceKey).not.toBe(failedKey);
            expect(screen.queryByText('Pattern not found')).not.toBeInTheDocument();
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
            renderAt('/');

            loadData();
            fireEvent.click(screen.getByTestId('select-node'));

            // The mobile node detail is now the bottom-sheet, and the old
            // full-screen slide-in takeover is gone.
            expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
            expect(screen.getByText('Node One')).toBeInTheDocument();
            expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();

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

    it('opens inline inspector Details (not the bottom-sheet) on desktop when a node is selected', () => {
        // Desktop default matchMedia (matches:false): the node detail is the inline inspector, never the mobile NodeSheet.
        renderAt('/');
        loadData();
        fireEvent.click(screen.getByTestId('select-node'));
        expect(screen.queryByTestId('node-sheet')).not.toBeInTheDocument();
        expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
        expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Details');
        expect(details().getByText('Node One')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Details & extensions' })).not.toBeInTheDocument();
    });

    describe('the inspector', () => {
        const toggle = () => screen.getByRole('button', { name: 'Details & extensions' });
        const inspector = () => screen.queryByRole('complementary', { name: 'Inspector' });
        const designerTabs = [fakeExtension(1, ['designer-tab']), fakeExtension(2, ['designer-tab'])];
        let call: MockInstance<ExtensionService['call']>;
        beforeEach(() => {
            call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        });
        afterEach(() => call.mockRestore());

        it('shows the resource with no selection, keeps the diagram mounted, and gives focus back to its toggle', () => {
            renderAt('/');
            loadArchitectureWithNodes();
            const diagram = screen.getByTestId('diagram-section');
            expect(inspector()).not.toBeInTheDocument();

            toggle().focus();
            fireEvent.click(toggle());
            expect(inspector()).toBeInTheDocument();
            expect(inspectorSelector()).toHaveFocus();
            expect(screen.getByText('Whole architecture. Select a node to see its views.')).toBeInTheDocument();
            expect(details().getByText('Nodes').nextElementSibling).toHaveTextContent('3');

            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
            expect(inspector()).not.toBeInTheDocument();
            expect(toggle()).toHaveFocus();
            expect(screen.getByTestId('diagram-section')).toBe(diagram);
        });

        it('keeps the selection when it closes, and Clear selection clears it', () => {
            renderAt('/');
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n2'));
            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
            expect(inspector()).not.toBeInTheDocument();

            fireEvent.click(toggle());
            expect(details().getByText('Node Two')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
            expect(inspector()).toBeInTheDocument();
            expect(screen.getByText('Whole architecture. Select a node to see its views.')).toBeInTheDocument();
        });

        it('opens again on a click on the selected node after it closed', () => {
            renderAt('/');
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n2'));
            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
            expect(inspector()).not.toBeInTheDocument();

            fireEvent.click(screen.getByTestId('select-n2'));
            expect(inspector()).toBeInTheDocument();
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Details');
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        // The resource stays loaded, so the selection does not change: only the link opens the inspector.
        it('opens again on a link that names the selected node, and not on a close that changes the URL', () => {
            const DETAIL = '/test-namespace/architectures/arch/1.0';
            render(
                <ExtensionsContext.Provider value={designerTabs}>
                    <MemoryRouter initialEntries={[DETAIL]}>
                        <Hub />
                        <Link to={`${DETAIL}?node=n2&exact=1`}>Open Node Two</Link>
                        <Link to={`${DETAIL}?node=n2&extension=ext-1&exact=1`}>Open Extension 1 for Node Two</Link>
                        <LocationProbe />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n2'));
            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));

            fireEvent.click(screen.getByRole('link', { name: 'Open Node Two' }));
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Details');
            expect(details().getByText('Node Two')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('link', { name: 'Open Extension 1 for Node Two' }));
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
            expect(screen.getByTestId('location-search')).toHaveTextContent(/^\?node=n2&exact=1$/);
            expect(inspector()).not.toBeInTheDocument();
        });

        // The router gives two entries that the browser made at the same URL the same location.
        it('opens again on each move to an entry whose URL names the selected node, also at the same URL', async () => {
            const linked = '/test-namespace/architectures/arch/1.0?node=n2&exact=1';
            window.history.replaceState(null, '', `#${linked}`);
            render(
                <HashRouter>
                    <Hub storage={createMemoryStorage()} />
                </HashRouter>
            );
            loadArchitectureWithNodes();
            const close = () => {
                fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
                expect(inspector()).not.toBeInTheDocument();
            };
            expect(details().getByText('Node Two')).toBeInTheDocument();
            close();

            act(() => {
                window.history.pushState(null, '', `#${linked}`);
                window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            });
            expect(details().getByText('Node Two')).toBeInTheDocument();
            close();

            await act(
                () =>
                    new Promise<void>((resolve) => {
                        window.addEventListener('popstate', () => resolve(), { once: true });
                        window.history.back();
                    })
            );
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        // The browser makes an entry with no history state for a URL that the user edits in the tab. Close then goes back to
        // the URL of the first visit, which is not a visit to the same URL.
        it('keeps the loaded resource when the inspector closes after an edit of the URL opened an extension', () => {
            const first = '/test-namespace/architectures/arch/1.0?exact=1';
            window.history.replaceState(null, '', `#${first}`);
            render(
                <ExtensionsContext.Provider value={designerTabs}>
                    <HashRouter>
                        <Hub storage={createMemoryStorage()} />
                    </HashRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
            const resource = captured?.resourceKey;

            act(() => {
                window.history.pushState(null, '', `#${first}&extension=ext-1`);
                window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
            });
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));

            expect(window.location.hash).toBe(`#${first}`);
            expect(inspector()).not.toBeInTheDocument();
            expect(captured?.resourceKey).toBe(resource);
        });

        it('opens the extension that a link names, and keeps it and the selection while the selection or the extension changes', async () => {
            renderWithNav('/?extension=ext-1', ['/?extension=ext-2'], designerTabs);
            loadArchitectureWithNodes();
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
            expect(call.mock.calls[0][2]).toMatchObject({ resource: 'architectures/arch', selectedElement: undefined });

            fireEvent.click(screen.getByTestId('select-n1'));
            fireEvent.click(screen.getByTestId('select-n2'));
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            await waitFor(() => expect(call.mock.calls.at(-1)?.[2]).toMatchObject({ selectedElement: 'n2' }));

            navigateTo('/?extension=ext-2');
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 2 — designer-tab 2');
            expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
            await waitFor(() => expect(call.mock.calls.at(-1)?.[0]).toBe('ext-2'));
            expect(call.mock.calls.at(-1)?.[2]).toMatchObject({ selectedElement: 'n2' });
        });

        // The router shows the new query in a transition, after the click: the inspector must not close for a render.
        it('stays open and keeps focus on its selector when the user chooses an extension from Details', () => {
            renderWithNav('/', [], designerTabs);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n2'));
            const wrapper = inspector()!.parentElement!;
            const changes = new MutationObserver(() => undefined);
            changes.observe(wrapper, { attributes: true, attributeFilter: ['hidden'] });

            inspectorSelector().focus();
            chooseInspectorView('designer-tab 1');
            expect(changes.takeRecords()).toEqual([]);
            changes.disconnect();
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            expect(inspectorSelector()).toHaveFocus();
        });

        it('returns from Details to an extension and keeps it when the inspector opens again', () => {
            renderWithNav('/?extension=ext-2', [], designerTabs);
            loadArchitectureWithNodes();
            chooseInspectorView('Details');
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Details');

            chooseInspectorView('designer-tab 2');
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 2 — designer-tab 2');

            fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
            fireEvent.click(toggle());
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 2 — designer-tab 2');
        });

        it('opens the inspector for an old Extensions tab link, and says when no extension applies', () => {
            renderAt('/?tab=extensions');
            loadData();
            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extensions');
            expect(screen.getByText('No extension adds a view to this resource.')).toBeInTheDocument();
        });

        it('sends no request for an extension that a link asks for and that does not apply', () => {
            renderWithNav('/?extension=missing', [], designerTabs);
            loadData();
            expect(screen.getByText('No extension adds a view to this resource.')).toBeInTheDocument();
            expect(call).not.toHaveBeenCalled();
        });

        it('gives extensions no context for a dropped file, and clears a node of the file when it goes away', () => {
            renderWithNav('/?extension=ext-1', [], designerTabs);
            loadData();
            fireEvent.click(screen.getByTestId('drop-file'));
            expect(screen.getByText('Extensions need a resource from CALM Hub. A dropped file has none.')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('select-node'));
            expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('lose-dropped-file'));
            expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
        });

        it('keeps a node of the architecture when no file was dropped', () => {
            renderAt('/');
            loadData();
            fireEvent.click(screen.getByTestId('select-node'));
            fireEvent.click(screen.getByTestId('lose-dropped-file'));
            expect(details().getByText('Node One')).toBeInTheDocument();
        });

        it('opens full screen from the node sheet on a narrow screen, and Back to diagram and Escape go back to the sheet', () => {
            const restore = mockMobileViewport(true);
            try {
                renderAt('/');
                loadArchitectureWithNodes();
                fireEvent.click(screen.getByTestId('select-n1'));
                const openFromSheet = within(screen.getByTestId('node-sheet')).getByRole('button', { name: 'Inspector' });
                openFromSheet.focus();
                fireEvent.click(openFromSheet);

                const dialog = screen.getByRole('dialog', { name: 'Inspector' });
                expect(screen.queryByTestId('node-sheet')).not.toBeVisible();
                expect(within(dialog).getByRole('button', { name: 'Inspector view: Details' })).toHaveFocus();
                expect(within(dialog).queryByRole('button', { name: 'Close inspector' })).not.toBeInTheDocument();

                fireEvent.click(within(dialog).getByRole('button', { name: 'Back to diagram' }));
                expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();
                expect(screen.getByTestId('node-sheet')).toBeVisible();
                expect(openFromSheet).toHaveFocus();

                // Escape: the browser sends cancel to the modal dialog.
                fireEvent.click(openFromSheet);
                fireEvent(screen.getByRole('dialog', { name: 'Inspector' }), new Event('cancel', { cancelable: true }));
                expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();
                expect(openFromSheet).toHaveFocus();
            } finally {
                restore();
            }
        });

        // Real events with no act, so React renders each event and leaves the router's transition for later. Then it waits
        // until the router shows the last entry of its history, for no fixed time: with coverage or load, a render can take
        // longer. The entry must stay for two checks, because Hub's effects for that render can navigate again.
        const withoutAct = async (run: () => Promise<void>) => {
            const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
            const actEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
            environment.IS_REACT_ACT_ENVIRONMENT = false;
            try {
                if (!routerView.history) throw new Error('withoutAct needs a LocationProbe in the router');
                await run();
                for (let checks = 0, held = 0; held < 2; checks++) {
                    if (checks === 600) throw new Error('The router did not show the last entry of its history');
                    await new Promise((resolve) => setTimeout(resolve, 5));
                    held = routerView.history?.location.key === routerView.shownKey ? held + 1 : 0;
                }
            } finally {
                environment.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
            }
        };
        // Each one takes longer than a frame while it is slow, so the router's transition yields after it, after Hub.
        const slowRender = { on: false, entered: false };
        const renderSlowly = (search: string) => {
            if (!slowRender.on || !search.includes('extension=ext-1')) return;
            slowRender.entered = true;
            const end = performance.now() + 8;
            while (performance.now() < end);
        };
        function SlowAfterHub() {
            renderSlowly(useLocation().search);
            return null;
        }

        // The router shows the extension in a transition. Escape can come before it renders, or after it rendered Hub
        // and yielded: the close replaces the extension that is on its way.
        it.each([
            ['before the router renders the extension', false],
            ['while the router render of the extension waits', true],
        ])('stays closed after Escape that comes %s', async (_, yieldsAfterHub) => {
            const restore = mockMobileViewport(true);
            try {
                render(
                    <ExtensionsContext.Provider value={designerTabs}>
                        <MemoryRouter initialEntries={['/?node=n1&exact=1']}>
                            <Hub />
                            {Array.from({ length: 10 }, (_, index) => (
                                <SlowAfterHub key={index} />
                            ))}
                            <LocationProbe />
                        </MemoryRouter>
                    </ExtensionsContext.Provider>
                );
                loadArchitectureWithNodes();
                const openFromSheet = within(screen.getByTestId('node-sheet')).getByRole('button', { name: 'Inspector' });
                openFromSheet.focus();
                fireEvent.click(openFromSheet);
                fireEvent.click(inspectorSelector());
                const choice = screen.getByRole('menuitemradio', { name: 'designer-tab 1' });
                const diagram = screen.getByTestId('diagram-section');
                const resource = captured?.resourceKey;

                await withoutAct(async () => {
                    slowRender.on = yieldsAfterHub;
                    slowRender.entered = false;
                    choice.click();
                    await Promise.resolve();
                    for (let tries = 0; yieldsAfterHub && !slowRender.entered && tries < 100; tries++) {
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                    expect(slowRender.entered).toBe(yieldsAfterHub);
                    expect(screen.getByTestId('location-search')).toHaveTextContent(/^\?node=n1&exact=1$/);
                    expect(screen.getByRole('dialog', { name: 'Inspector' })).toHaveAttribute('open');
                    screen.getByRole('dialog', { name: 'Inspector' }).dispatchEvent(new Event('cancel', { cancelable: true }));
                    slowRender.on = false;
                });

                await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(/^\?node=n1&exact=1$/));
                expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();
                expect(openFromSheet).toHaveFocus();
                // A navigation that leaves the query as it is would load the resource again and clear the selection.
                expect(screen.getByTestId('diagram-section')).toBe(diagram);
                expect(captured?.resourceKey).toBe(resource);
                expect(within(screen.getByTestId('node-sheet')).getByText('Node One')).toBeInTheDocument();
            } finally {
                slowRender.on = false;
                restore();
            }
        });

        it('opens on the extension again when it closes and opens before the router shows the extension', async () => {
            render(
                <ExtensionsContext.Provider value={designerTabs}>
                    <MemoryRouter initialEntries={['/?node=n1&exact=1']}>
                        <Hub />
                        <LocationProbe />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
            fireEvent.click(inspectorSelector());
            const choice = screen.getByRole('menuitemradio', { name: 'designer-tab 1' });
            const resource = captured?.resourceKey;

            await withoutAct(async () => {
                choice.click();
                await Promise.resolve();
                screen.getByRole('button', { name: 'Close inspector' }).click();
                await Promise.resolve();
                screen.getByRole('button', { name: 'Details & extensions' }).click();
            });

            expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — designer-tab 1');
            expect(captured?.resourceKey).toBe(resource);
        });

        // Only Hub's own write of the inspector, known by its id in history state, keeps the user's latest choice. Any
        // later navigation decides the inspector, also a replace to the URL of that write.
        it.each([
            ['a link', '?node=n1&exact=1&extension=ext-1', false],
            ['a replace to another extension', '?node=n1&exact=1&extension=ext-2', true],
            ['a replace to the URL of the pending write', '?node=n1&exact=1&extension=ext-1', true],
        ])('lets %s after a close that waits for the router decide the inspector', async (_, to, replace) => {
            function OtherNavigation() {
                const navigate = useNavigate();
                const location = useLocation();
                return (
                    <>
                        <button onClick={() => navigate(to, { replace, state: { sentinel: 'other', returnTo: [] } })}>Other navigation</button>
                        <output data-testid="state">{JSON.stringify(location.state)}</output>
                    </>
                );
            }
            render(
                <ExtensionsContext.Provider value={designerTabs}>
                    <MemoryRouter initialEntries={[{ pathname: '/', search: '?node=n1&exact=1', state: { sentinel: 'keep' } }]}>
                        <Hub />
                        <OtherNavigation />
                        <LocationProbe />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
            fireEvent.click(inspectorSelector());
            const choice = screen.getByRole('menuitemradio', { name: 'designer-tab 1' });

            await withoutAct(async () => {
                choice.click();
                await Promise.resolve();
                screen.getByRole('button', { name: 'Close inspector' }).click();
                await Promise.resolve();
                screen.getByRole('button', { name: 'Other navigation' }).click();
            });

            expect(screen.getByTestId('location-search').textContent).toBe(to);
            expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({ sentinel: 'other', returnTo: [] });
            expect(inspectorSelector()).toHaveAccessibleName(
                to.endsWith('ext-2') ? 'Inspector view: Extension 2 — designer-tab 2' : 'Inspector view: Extension 1 — designer-tab 1'
            );
        });

        // A selection of another node takes `node` out of the URL with one of Hub's writes. A view that the user chose
        // just before it, which the router has not shown yet, goes in that write, and a view chosen just after it waits.
        it.each([
            ['an extension chosen just before', '?node=n1&exact=1', 'designer-tab 1', false, ['?exact=1&extension=ext-1']],
            ['Details chosen just before', '?node=n1&extension=ext-1&exact=1', 'Details', false, ['?exact=1']],
            ['an extension chosen just after', '?node=n1&exact=1', 'designer-tab 1', true, ['?exact=1', '?exact=1&extension=ext-1']],
        ])('keeps Node Two selected and %s, before the router shows either', async (_, start, view, selectFirst, writes) => {
            const end = writes[writes.length - 1];
            const shown: string[] = [];
            function StateProbe() {
                const { search, state } = useLocation();
                React.useEffect(() => void shown.push(search), [search]);
                return <output data-testid="state">{JSON.stringify(state)}</output>;
            }
            render(
                <ExtensionsContext.Provider value={designerTabs}>
                    <MemoryRouter initialEntries={[{ pathname: '/', search: start, state: { sentinel: 'keep', returnTo: [] } }]}>
                        <Hub />
                        <StateProbe />
                        <LocationProbe />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
            const diagram = screen.getByTestId('diagram-section');
            const resource = captured?.resourceKey;
            const handler = diagramItemSelect;
            fireEvent.click(inspectorSelector());
            const choice = screen.getByRole('menuitemradio', { name: view });

            await withoutAct(async () => {
                if (selectFirst) screen.getByTestId('select-n2').click();
                else choice.click();
                await Promise.resolve();
                expect(screen.getByTestId('location-search').textContent).toBe(start);
                if (selectFirst) choice.click();
                else screen.getByTestId('select-n2').click();
            });

            expect(screen.getByTestId('location-search').textContent).toBe(end);
            // No URL in between names the selection without the view: a copied link or a reload keeps both.
            expect(shown).toEqual([start, ...writes]);
            expect(inspectorSelector()).toHaveAccessibleName(
                view === 'Details' ? 'Inspector view: Details' : 'Inspector view: Extension 1 — designer-tab 1'
            );
            // The selection bar above each view names the selection.
            expect(screen.getByTitle('n2')).toHaveTextContent('Node Two');
            expect(JSON.parse(screen.getByTestId('state').textContent!)).toMatchObject({ sentinel: 'keep', returnTo: [] });
            expect(screen.getByTestId('diagram-section')).toBe(diagram);
            expect(captured?.resourceKey).toBe(resource);
            expect(diagramItemSelect).toBe(handler);
        });

        // The inspector moves between the side panel and the full-screen dialog. Its chosen view and the state of its slots
        // stay, also while it is closed, and it sends no request for the move.
        it.each([
            ['a wide screen', false],
            ['a narrow screen', true],
        ])('keeps the chosen view and its table filter across the breakpoint, from %s and back', async (_, narrow) => {
            const viewport = resizableViewport(narrow);
            try {
                const twoViews: ExtensionSummary = {
                    ...fakeExtension(1, []),
                    contributes: {
                        'designer-tab': [
                            { id: 'first', title: 'First view', route: 'data' },
                            { id: 'second', title: 'Second view', route: 'data' },
                        ],
                    },
                };
                call.mockResolvedValue({
                    hubApi: 0,
                    blocks: [{ type: 'table', id: 'rows', columns: ['Name'], rows: [['alpha'], ['beta']], search: { label: 'Filter rows' } }],
                });
                renderWithNav('/?extension=ext-1', [], [twoViews]);
                loadArchitectureWithNodes();
                fireEvent.click(inspectorSelector());
                fireEvent.click(screen.getByRole('menuitemradio', { name: 'Second view' }));
                const second = await screen.findByRole('region', { name: 'Second view' });
                fireEvent.change(await within(second).findByRole('searchbox', { name: 'Filter rows' }), { target: { value: 'beta' } });
                await waitFor(() => expect(within(second).queryByText('alpha')).not.toBeInTheDocument());
                const requests = call.mock.calls.length;
                const keptState = () => {
                    expect(inspectorSelector()).toHaveAccessibleName('Inspector view: Extension 1 — Second view');
                    const region = screen.getByRole('region', { name: 'Second view' });
                    expect(within(region).getByRole('searchbox', { name: 'Filter rows' })).toHaveValue('beta');
                    expect(within(region).getByText('beta')).toBeInTheDocument();
                    expect(within(region).queryByText('alpha')).not.toBeInTheDocument();
                };

                viewport.set(!narrow);
                keptState();

                fireEvent.click(screen.getByRole('button', { name: narrow ? 'Close inspector' : 'Back to diagram' }));
                viewport.set(narrow);
                fireEvent.click(toggle());
                keptState();
                expect(screen.getAllByTestId('inspector-extension')).toHaveLength(1);
                expect(call.mock.calls.length).toBe(requests);
            } finally {
                viewport.restore();
            }
        });

        // A move to the other host ends the modal state of an open confirmation in the browser. It must show on top again,
        // with focus on Cancel, so that Enter does not send the write and Escape cancels it.
        const noteForm: ExtensionSummary = {
            id: 'ext-1',
            name: 'Extension 1',
            hubApi: 0,
            routes: [
                { id: 'data', method: 'GET', path: '/data', scope: 'authenticated', readOnly: true },
                { id: 'note', method: 'POST', path: '/note', scope: 'authenticated', readOnly: false },
            ],
            contributes: {
                'designer-tab': [{ id: 'notes', title: 'Notes', route: 'data' }],
                form: [{ id: 'note', title: 'Add a note', route: 'note', target: 'none', submitLabel: 'Add note', fields: [{ id: 'text', type: 'multiline', label: 'Note', required: true }] }],
            },
        };
        it.each([
            ['an action', 'a wide', false],
            ['an action', 'a narrow', true],
            ['a form', 'a wide', false],
            ['a form', 'a narrow', true],
        ])('keeps the confirmation of %s modal, on top and on Cancel across the breakpoint, from %s screen', async (kind, _, narrow) => {
            const viewport = resizableViewport(narrow);
            const layer = modelTopLayer();
            const submitForm = vi.spyOn(ExtensionService.prototype, 'submitForm');
            try {
                const action = kind === 'an action';
                if (!action) call.mockResolvedValue({ hubApi: 0, blocks: [{ type: 'form', form: 'note' }] });
                // As in the app: StrictMode attaches the ref of a new host twice.
                render(
                    <ExtensionsContext.Provider value={[action ? fakeExtension(1, ['designer-tab', 'action']) : noteForm]}>
                        <MemoryRouter initialEntries={['/?extension=ext-1']}>
                            <Hub />
                        </MemoryRouter>
                    </ExtensionsContext.Provider>,
                    { reactStrictMode: true }
                );
                loadArchitectureWithNodes();
                if (action) {
                    fireEvent.click(await screen.findByRole('button', { name: 'Run 1' }));
                } else {
                    fireEvent.change(await screen.findByRole('textbox', { name: /^Note\b/ }), { target: { value: 'Keep this note' } });
                    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
                }
                const confirmation = await screen.findByRole('dialog', { name: action ? 'Confirm action' : 'Confirm submission' });
                const opener = screen.getByRole('button', { name: action ? 'Run 1' : 'Add note' });
                const inspectorDialog = () => document.querySelector<HTMLDialogElement>(`dialog#${INSPECTOR_ID}`);
                await waitFor(() => expect(layer.top()).toBe(confirmation));

                viewport.set(!narrow);
                expect(screen.getByRole('dialog', { name: action ? 'Confirm action' : 'Confirm submission' })).toBe(confirmation);
                expect(layer.top()).toBe(confirmation);
                expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();
                if (!narrow) expect(inspectorDialog()?.matches(':modal')).toBe(true);

                layer.escape();
                expect(confirmation).not.toBeInTheDocument();
                expect(layer.top()).toBe(narrow ? undefined : inspectorDialog());
                await waitFor(() => expect(opener).toHaveFocus());
                if (!action) expect(screen.getByRole('textbox', { name: /^Note\b/ })).toHaveValue('Keep this note');
                expect(call.mock.calls.filter(([, route]) => route.method === 'POST')).toHaveLength(0);
                expect(submitForm).not.toHaveBeenCalled();
            } finally {
                submitForm.mockRestore();
                layer.restore();
                viewport.restore();
            }
        });

        it('opens full screen from the edge handle on a narrow screen with no selection, and gives focus back to the handle', () => {
            const restore = mockMobileViewport(true);
            try {
                renderAt('/');
                loadArchitectureWithNodes();
                toggle().focus();
                fireEvent.click(toggle());

                const dialog = screen.getByRole('dialog', { name: 'Inspector' });
                expect(within(dialog).getByRole('button', { name: 'Inspector view: Details' })).toHaveFocus();
                expect(within(dialog).getByText('Whole architecture. Select a node to see its views.')).toBeInTheDocument();

                fireEvent.click(within(dialog).getByRole('button', { name: 'Back to diagram' }));
                expect(screen.queryByRole('dialog', { name: 'Inspector' })).not.toBeInTheDocument();
                expect(toggle()).toHaveFocus();
            } finally {
                restore();
            }
        });
    });

    describe('decorators in the details drawer', () => {
        it('lists the decorators of the selected node on desktop', () => {
            renderAt('/');
            loadData();
            fireEvent.click(screen.getByTestId('report-decorators'));
            fireEvent.click(screen.getByTestId('select-node'));

            expect(screen.getByRole('heading', { name: 'All decorators' })).toBeInTheDocument();
            expect(screen.getByRole('article', { name: 'observability decorator obs-n1' })).toBeInTheDocument();
            expect(screen.queryByRole('article', { name: 'observability decorator obs-n2' })).not.toBeInTheDocument();
        });

        it('lists the decorators of the selected node in the mobile sheet', () => {
            const restore = mockMobileViewport(true);
            renderAt('/');
            loadData();
            fireEvent.click(screen.getByTestId('report-decorators'));
            fireEvent.click(screen.getByTestId('select-node'));

            expect(screen.getByTestId('node-sheet')).toBeInTheDocument();
            expect(screen.getByRole('article', { name: 'observability decorator obs-n1' })).toBeInTheDocument();
            restore();
        });

        const loadArchitectureWithRelationships = (relationships: unknown) =>
            act(() => {
                captured?.onDataLoad({
                    id: 'arch',
                    version: '1.0',
                    calmType: 'Architectures',
                    name: 'test-namespace',
                    data: { nodes: [], relationships },
                } as unknown as Data);
            });
        const deployedIn = {
            'unique-id': 'n1-in-cluster',
            'relationship-type': { 'deployed-in': { container: 'cluster', nodes: ['n1'] } },
        };

        it('lists the decorators of a containment relationship on its container', () => {
            renderAt('/');
            loadArchitectureWithRelationships([deployedIn]);
            fireEvent.click(screen.getByTestId('report-containment-decorator'));
            fireEvent.click(screen.getByTestId('select-cluster'));

            expect(screen.getByRole('article', { name: 'observability decorator obs-deploy' })).toBeInTheDocument();
        });

        it('keeps the view and the containment decorators when the relationships hold malformed entries', () => {
            renderAt('/');
            loadArchitectureWithRelationships([null, 'bad', { 'relationship-type': null }, deployedIn]);
            fireEvent.click(screen.getByTestId('report-containment-decorator'));
            fireEvent.click(screen.getByTestId('select-cluster'));

            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
            expect(screen.getByRole('article', { name: 'observability decorator obs-deploy' })).toBeInTheDocument();
        });

        it('keeps the view when the relationships are not a list', () => {
            renderAt('/');
            loadArchitectureWithRelationships({ not: 'a list' });
            fireEvent.click(screen.getByTestId('report-containment-decorator'));
            fireEvent.click(screen.getByTestId('select-cluster'));

            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'All decorators' })).not.toBeInTheDocument();
        });

        it('shows no Decorators section when none applies to the selected element', () => {
            renderAt('/');
            loadData();
            fireEvent.click(screen.getByTestId('report-decorators'));
            fireEvent.click(screen.getByTestId('select-edge'));

            expect(screen.queryByRole('heading', { name: 'All decorators' })).not.toBeInTheDocument();
        });
    });

    describe('the node query parameter', () => {
        afterEach(() => {
            window.history.replaceState(null, '', '/');
        });

        it('opens the node the link names when the diagram loads', () => {
            renderAt('/?node=n2');
            loadArchitectureWithNodes();
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        it('opens the relationship that a link names, as a lens names one', () => {
            renderAt('/?node=n1-calls-n2');
            act(() => {
                captured?.onDataLoad({
                    id: 'arch', version: '1.0', calmType: 'Architectures', name: 'test-namespace',
                    data: {
                        nodes: [{ 'unique-id': 'n1', name: 'Node One', 'node-type': 'service' }],
                        relationships: [{ 'unique-id': 'n1-calls-n2', 'relationship-type': { connects: { source: { node: 'n1' }, destination: { node: 'n2' } } } }],
                    },
                } as unknown as Data);
            });
            expect(details().getByText('n1-calls-n2')).toBeInTheDocument();
        });

        it('selects nothing when the node is not in the diagram', () => {
            renderAt('/?node=missing');
            loadArchitectureWithNodes();
            expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
        });

        it('opens the other node when the link changes to name it', () => {
            renderWithNav('/?node=n1', ['/?node=n2']);
            loadArchitectureWithNodes();
            expect(details().getByText('Node One')).toBeInTheDocument();
            navigateTo('/?node=n2');
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.queryByText('Node One')).not.toBeInTheDocument();
        });

        it('keeps the node open after a query change that keeps it in the URL', () => {
            renderWithNav('/?node=n2', ['/?node=n2&tab=json']);
            loadArchitectureWithNodes();
            navigateTo('/?node=n2&tab=json');
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        it('keeps a node the user selects, and stops naming the linked node in the URL', () => {
            renderWithLocation(['/?tab=json&node=n2']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n1'));
            expect(details().getByText('Node One')).toBeInTheDocument();
            expect(screen.getByTestId('location-search')).toHaveTextContent(/^\?tab=json$/);
        });

        it('keeps the URL when the user selects the node it names', () => {
            renderWithLocation(['/?node=n2']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n2'));
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.getByTestId('location-search')).toHaveTextContent('?node=n2');
        });

        it('stops naming the node in the URL when the user clears the selection', () => {
            renderWithLocation(['/?node=n2']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
            expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
            expect(screen.getByTestId('location-search')).toBeEmptyDOMElement();
        });

        it('clears a node the user selected when the query changes', () => {
            renderWithNav('/', ['/?tab=json']);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n1'));
            expect(details().getByText('Node One')).toBeInTheDocument();
            navigateTo('/?tab=json');
            expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
        });

        it('keeps a node the user selected when only the diagram lens or its parameters change', () => {
            renderWithNav('/', ['/?lens=c4', '/?lens=c4&level=container', '/'], [C4_EXTENSION]);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n1'));
            navigateTo('/?lens=c4');
            navigateTo('/?lens=c4&level=container');
            navigateTo('/');
            expect(details().getByText('Node One')).toBeInTheDocument();
        });

        it('keeps the selection when a lens opens from an explicit Diagram tab link', () => {
            renderWithNav('/?tab=diagram', ['/?lens=c4'], [C4_EXTENSION]);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('select-n1'));
            navigateTo('/?lens=c4');
            expect(details().getByText('Node One')).toBeInTheDocument();
        });

        it('ignores a node query on the page URL outside the hash route', () => {
            window.history.replaceState(null, '', '/?node=n2');
            renderAt('/');
            loadArchitectureWithNodes();
            expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
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

    describe('return points and links into the page', () => {
        const DETAIL = '/test-namespace/architectures/arch/1.0';

        function StateProbe() {
            const location = useLocation();
            return (
                <>
                    <div data-testid="state-pathname">{location.pathname}</div>
                    <div data-testid="state">{JSON.stringify(location.state)}</div>
                </>
            );
        }

        const renderDetail = (
            entry: string | { pathname: string; state: unknown },
            extensions: ExtensionSummary[] = []
        ) =>
            render(
                <ExtensionsContext.Provider value={extensions}>
                    <MemoryRouter initialEntries={[entry]}>
                        <Hub />
                        <StateProbe />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );

        it('records the resource version and the selected node as the return point of a link', () => {
            renderDetail(DETAIL);
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('set-display-name'));
            fireEvent.click(screen.getByTestId('select-n1'));
            fireEvent.click(screen.getByRole('link', { name: 'Open reviews' }));

            expect(screen.getByTestId('state-pathname')).toHaveTextContent('/extensions/assurance/reviews');
            expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
                returnTo: [
                    {
                        page: { kind: 'resource', namespace: 'test-namespace', type: 'architectures', id: 'arch', version: '1.0' },
                        search: '?node=n1',
                        label: 'Nice Name 1.0',
                    },
                ],
            });
        });

        it('links back to the list that opened the page, with its filters', () => {
            renderDetail({
                pathname: DETAIL,
                state: { returnTo: [{ page: { kind: 'screen', extension: 'assurance', screen: 'reviews' }, search: '?reviews.filter=needs-review', label: 'Architecture reviews' }] },
            });
            expect(screen.getByRole('link', { name: 'Back to Architecture reviews' })).toHaveAttribute(
                'href',
                '/extensions/assurance/reviews?reviews.filter=needs-review'
            );
        });

        it('keeps the return point through a detailed-architecture hop', () => {
            const returnTo = [{ page: { kind: 'search' }, search: '?q=pay', label: 'search results' }];
            renderDetail({ pathname: DETAIL, state: { returnTo } });
            loadArchitectureWithNodes();
            fireEvent.click(screen.getByTestId('navigate-detailed-arch'));
            expect(JSON.parse(screen.getByTestId('state').textContent!).returnTo).toEqual(returnTo);
        });

        it('says when the linked element is not in this version, and still shows the diagram', () => {
            renderDetail(`${DETAIL}?node=missing`);
            loadArchitectureWithNodes();
            expect(screen.getByRole('status')).toHaveTextContent('The element "missing" is not in version 1.0 of this architecture.');
            expect(screen.getByTestId('diagram-section')).toBeInTheDocument();
        });

        // A pattern declares its elements in JSON Schema, as patternTransformer reads them: directly or in an allOf
        // branch, and as the alternatives of a oneOf or anyOf choice.
        describe('in a pattern', () => {
            const PATTERN_DETAIL = '/test-namespace/patterns/pat/1.0';
            const declared = (id: string, fields: Record<string, unknown> = {}) => ({
                $ref: 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node',
                properties: Object.fromEntries(Object.entries({ 'unique-id': id, ...fields }).map(([key, value]) => [key, { const: value }])),
            });
            const pattern = {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        prefixItems: [
                            declared('web', { name: 'Web app', 'node-type': 'webclient', description: 'The front end' }),
                            { oneOf: [declared('pg', { name: 'Postgres', 'node-type': 'database' }), declared('mongo', { name: 'Mongo', 'node-type': 'database' })] },
                        ],
                        items: { anyOf: [declared('cache', { name: 'Cache', 'node-type': 'service' })] },
                    },
                },
                allOf: [
                    {
                        properties: {
                            relationships: {
                                prefixItems: [
                                    declared('web-reads-pg', {
                                        description: 'Reads orders',
                                        'relationship-type': { connects: { source: { node: 'web' }, destination: { node: 'pg' } } },
                                    }),
                                ],
                            },
                        },
                    },
                ],
            };
            const loadPattern = () =>
                act(() => {
                    captured?.onDataLoad({ id: 'pat', version: '1.0', calmType: 'Patterns', name: 'test-namespace', data: pattern } as unknown as Data);
                });

            it.each([
                ['web', 'Web app'],
                ['mongo', 'Mongo'],
                ['cache', 'Cache'],
            ])('opens the node %s that a link names, with the name that the diagram shows', (id, name) => {
                renderDetail(`${PATTERN_DETAIL}?node=${id}`);
                loadPattern();
                expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
                expect(details().getByText(name)).toBeInTheDocument();
                expect(screen.queryByTestId('return-bar')).not.toBeInTheDocument();
            });

            it('opens the relationship that a link names', () => {
                renderDetail(`${PATTERN_DETAIL}?node=web-reads-pg`);
                loadPattern();
                expect(details().getByText('web-reads-pg')).toBeInTheDocument();
                expect(details().getByText('Reads orders')).toBeInTheDocument();
                expect(screen.queryByTestId('return-bar')).not.toBeInTheDocument();
            });

            it('says when the linked element is not in this version, and selects nothing', () => {
                renderDetail(`${PATTERN_DETAIL}?node=missing`);
                loadPattern();
                expect(screen.getByRole('status')).toHaveTextContent('The element "missing" is not in version 1.0 of this pattern.');
                expect(screen.queryByRole('button', { name: 'Clear selection' })).not.toBeInTheDocument();
            });
        });

        it('says when the linked extension is not enabled, and not when it applies', () => {
            const view = renderDetail(`${DETAIL}?tab=extensions&extension=ext-1`);
            loadArchitectureWithNodes();
            expect(within(screen.getByTestId('return-bar')).getByRole('status')).toHaveTextContent('The extension "ext-1" is not enabled in this Hub');
            view.unmount();

            renderDetail(`${DETAIL}?tab=extensions&extension=ext-1`, [fakeExtension(1)]);
            loadArchitectureWithNodes();
            expect(screen.queryByTestId('return-bar')).not.toBeInTheDocument();
        });
    });

    // Hub unmounts on the extension screen and mounts again on Back, as in the app.
    describe('the selection of a history entry', () => {
        const DETAIL = '/test-namespace/architectures/arch/1.0';
        const ScreenPage = () => (
            <div data-testid="screen-page">
                <ReturnLink />
            </div>
        );
        function History() {
            const navigate = useNavigate();
            const location = useLocation();
            const replace = (search: string) => navigate({ search }, { replace: true, state: location.state });
            return (
                <>
                    <button onClick={() => navigate(-1)}>Browser back</button>
                    <button onClick={() => navigate(1)}>Browser forward</button>
                    <button onClick={() => replace('?tab=json')}>Change tab</button>
                    <button onClick={() => replace('?lens=c4')}>Change lens</button>
                    <button onClick={() => navigate('/test-namespace/architectures/other/1.0')}>Open another architecture</button>
                    <div data-testid="url">{`${location.pathname}${location.search}`}</div>
                </>
            );
        }
        const renderHistory = (entry = DETAIL) => {
            const storage = createMemoryStorage();
            render(
                <ExtensionsContext.Provider value={[C4_EXTENSION]}>
                    <MemoryRouter initialEntries={[entry]}>
                        <Routes>
                            <Route path="/extensions/:extension/:screen" element={<ScreenPage />} />
                            <Route path="*" element={<Hub storage={storage} />} />
                        </Routes>
                        <History />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            );
            loadArchitectureWithNodes();
        };
        const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
        const openReviews = () => {
            fireEvent.click(screen.getByRole('link', { name: 'Open reviews' }));
            expect(screen.getByTestId('screen-page')).toBeInTheDocument();
        };
        const browserBack = () => {
            click('Browser back');
            expect(screen.queryByTestId('screen-page')).not.toBeInTheDocument();
            loadArchitectureWithNodes();
        };
        const selection = () => screen.queryByRole('button', { name: 'Clear selection' });

        it('opens the node that the user selected again after browser Back and Forward, with no node in the URL', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            openReviews();
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.getByTestId('url')).toHaveTextContent(/^\/test-namespace\/architectures\/arch\/1\.0$/);

            click('Browser forward');
            expect(screen.getByRole('link', { name: 'Back to arch 1.0' })).toHaveAttribute('href', `${DETAIL}?node=n2&exact=1`);
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        it('opens the node that the user selected again after Back from another resource, which keeps Hub mounted', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            click('Open another architecture');
            loadArchitectureWithNodes();
            expect(selection()).not.toBeInTheDocument();
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        it('opens the node that the user selected again from the explicit Back link', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            openReviews();
            fireEvent.click(screen.getByRole('link', { name: 'Back to arch 1.0' }));
            loadArchitectureWithNodes();
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.getByTestId('url')).toHaveTextContent(`${DETAIL}?node=n2&exact=1`);
        });

        it('opens the node that the user selected in place of a linked node, and keeps the node out of the URL', () => {
            renderHistory(`${DETAIL}?node=n1`);
            expect(details().getByText('Node One')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('select-n2'));
            expect(screen.getByTestId('url')).toHaveTextContent(/^\/test-namespace\/architectures\/arch\/1\.0$/);
            openReviews();
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.queryByText('Node One')).not.toBeInTheDocument();
        });

        it('keeps the node through a change of lens', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            click('Change lens');
            expect(details().getByText('Node Two')).toBeInTheDocument();
            openReviews();
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
            expect(screen.getByTestId('url')).toHaveTextContent(`${DETAIL}?lens=c4`);
        });

        it.each([
            ['a change of tab', () => click('Change tab')],
            ['Clear selection', () => click('Clear selection')],
        ])('opens no node again after %s', (_, clear) => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            clear();
            expect(selection()).not.toBeInTheDocument();
            openReviews();
            browserBack();
            expect(selection()).not.toBeInTheDocument();
        });

        it('keeps the node after a close of the inspector, and opens it again after Back', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('select-n2'));
            click('Close inspector');
            expect(screen.queryByRole('complementary', { name: 'Inspector' })).not.toBeInTheDocument();
            openReviews();
            browserBack();
            expect(details().getByText('Node Two')).toBeInTheDocument();
        });

        it('does not open a node of a dropped file on the architecture', () => {
            renderHistory();
            fireEvent.click(screen.getByTestId('drop-file'));
            fireEvent.click(screen.getByTestId('select-n2'));
            openReviews();
            browserBack();
            expect(selection()).not.toBeInTheDocument();
        });

        // The browser makes an entry with no history state for a first visit and for a URL that the user pastes, and
        // React Router gives each of them the key `default`.
        describe('in the browser history', () => {
            const renderBrowser = (storage = createMemoryStorage()) => {
                const view = render(
                    <ExtensionsContext.Provider value={[C4_EXTENSION]}>
                        <HashRouter>
                            <Routes>
                                <Route path="/extensions/:extension/:screen" element={<ScreenPage />} />
                                <Route path="*" element={<Hub storage={storage} />} />
                            </Routes>
                        </HashRouter>
                    </ExtensionsContext.Provider>
                );
                loadArchitectureWithNodes();
                return view;
            };
            const traverse = (delta: number) =>
                act(
                    () =>
                        new Promise<void>((resolve) => {
                            window.addEventListener('popstate', () => resolve(), { once: true });
                            window.history.go(delta);
                        })
                );
            beforeEach(() => window.history.replaceState(null, '', `#${DETAIL}`));

            it('opens nothing on a new visit to the same URL, and keeps the selection of the first visit', async () => {
                renderBrowser();
                fireEvent.click(screen.getByTestId('select-n2'));
                openReviews();

                act(() => {
                    window.history.pushState(null, '', `#${DETAIL}`);
                    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
                });
                loadArchitectureWithNodes();
                expect(selection()).not.toBeInTheDocument();
                fireEvent.click(screen.getByTestId('select-n1'));
                fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

                await traverse(-1);
                expect(screen.getByTestId('screen-page')).toBeInTheDocument();
                await traverse(-1);
                loadArchitectureWithNodes();
                expect(details().getByText('Node Two')).toBeInTheDocument();
            });

            // The same path with another query keeps Hub and the loaded resource.
            it('opens the node again after Back from a new visit to the same resource with another query', async () => {
                const storage = createMemoryStorage();
                const view = renderBrowser(storage);
                fireEvent.click(screen.getByTestId('select-n2'));

                act(() => {
                    window.history.pushState(null, '', `#${DETAIL}?tab=extensions`);
                    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
                });
                expect(selection()).not.toBeInTheDocument();

                await traverse(-1);
                expect(window.location.hash).toBe(`#${DETAIL}`);
                expect(details().getByText('Node Two')).toBeInTheDocument();
                view.unmount();

                renderBrowser(storage);
                expect(details().getByText('Node Two')).toBeInTheDocument();
            });

            // React Router gives two entries that the browser made at the same URL the same location, and renders nothing.
            const visit = (hash: string) =>
                act(() => {
                    window.history.pushState(null, '', `#${hash}`);
                    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
                });

            it('opens the node of each entry at the same URL after a move straight between them', async () => {
                const storage = createMemoryStorage();
                const view = renderBrowser(storage);
                fireEvent.click(screen.getByTestId('select-n2'));
                visit(`${DETAIL}?tab=extensions`);
                visit(DETAIL);
                expect(selection()).not.toBeInTheDocument();
                fireEvent.click(screen.getByTestId('select-n1'));

                await traverse(-2);
                expect(details().getByText('Node Two')).toBeInTheDocument();
                expect(screen.queryByText('Node One')).not.toBeInTheDocument();
                await traverse(2);
                expect(details().getByText('Node One')).toBeInTheDocument();
                await traverse(-2);
                view.unmount();

                renderBrowser(storage);
                expect(details().getByText('Node Two')).toBeInTheDocument();
            });

            it('opens nothing after a move straight to an entry at the same URL that has no selection', async () => {
                const storage = createMemoryStorage();
                const view = renderBrowser(storage);
                visit(`${DETAIL}?tab=extensions`);
                visit(DETAIL);
                fireEvent.click(screen.getByTestId('select-n1'));

                await traverse(-2);
                expect(selection()).not.toBeInTheDocument();
                view.unmount();
                renderBrowser(storage);
                expect(selection()).not.toBeInTheDocument();
                await traverse(2);
                expect(details().getByText('Node One')).toBeInTheDocument();
            });

            it('opens nothing on a new visit that changes only the lens, and the node again after Back', async () => {
                renderBrowser();
                fireEvent.click(screen.getByTestId('select-n2'));
                visit(`${DETAIL}?lens=c4`);
                expect(selection()).not.toBeInTheDocument();
                await traverse(-1);
                expect(details().getByText('Node Two')).toBeInTheDocument();
            });

            it('opens the node of a first visit again after a reload', () => {
                const storage = createMemoryStorage();
                const view = renderBrowser(storage);
                fireEvent.click(screen.getByTestId('select-n2'));
                view.unmount();

                renderBrowser(storage);
                expect(details().getByText('Node Two')).toBeInTheDocument();
            });
        });
    });
});
