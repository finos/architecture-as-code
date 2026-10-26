import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { getViewportForBounds, type Node, type Viewport } from 'reactflow';
import { CalmArchitectureSchema } from '@finos/calm-models/types';
import { ArchitectureGraph } from './ArchitectureGraph';
import { saveNodePositions, clearStoredNodePositions } from '../../services/node-position-service.js';
import { createPresentationModeStore, PRESENTATION_MODE_KEY, type PresentationModeStore } from '../../../theme/usePresentationMode.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { useDecisionOverlay, type DecisionOverlay } from '../../context/DecisionOverlayContext.js';

/**
 * Capture the props ReactFlow and MiniMap are rendered with, and render
 * Controls' children so the minimap toggle button is reachable. The real
 * ReactFlow is heavy and DOM-measurement dependent, so we stub it but keep the
 * props we assert on observable.
 */
const reactFlowProps: { current: Record<string, unknown> | null } = { current: null };
const miniMapProps: { current: Record<string, unknown> | null } = { current: null };
const controlsProps: { current: Record<string, unknown> | null } = { current: null };
const decisionOverlay: { current: DecisionOverlay | null } = { current: null };
// React strips `key` from the props a component receives, so a remount can't be
// observed by reading reactFlowProps — instead, a lazily-initialised bit of
// state (set once per mount, never again) doubles as a per-instance identity.
let reactFlowMountCount = 0;

// A named, capitalised function so react-hooks/rules-of-hooks recognises this
// as a component (an inline arrow assigned to a lowercase `default:` property
// doesn't look like one to the rule, even though React treats it as one).
function MockReactFlow(props: Record<string, unknown>) {
    reactFlowProps.current = props;
    const [instanceId] = useState(() => ++reactFlowMountCount);
    // The nodes and edges ReactFlow draws read the decision overlay from this context.
    const overlay = useDecisionOverlay();
    decisionOverlay.current = overlay;
    const { showDecisions, subjectLabels } = overlay;
    return (
        <div
            data-testid="react-flow"
            data-instance={instanceId}
            data-show-decisions={showDecisions}
            data-relationship-label={subjectLabels.get('rel-1')}
        >
            {props.children as ReactNode}
        </div>
    );
}

vi.mock('reactflow', async () => {
    // Keep the real hooks (useNodesState/useEdgesState/useStore) so the graph's
    // node state populates as it does in production; stub only the heavy,
    // DOM-measuring view components and capture their props.
    const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: MockReactFlow,
        Background: () => <div data-testid="rf-background" />,
        Controls: (props: { children?: ReactNode }) => {
            controlsProps.current = props;
            return <div data-testid="rf-controls">{props.children}</div>;
        },
        ControlButton: ({
            children,
            ...rest
        }: { children?: ReactNode } & Record<string, unknown>) => (
            <button {...(rest as Record<string, unknown>)}>{children}</button>
        ),
        MiniMap: (props: Record<string, unknown>) => {
            miniMapProps.current = props;
            return <div data-testid="diagram-minimap" />;
        },
        Panel: ({ children }: { children?: ReactNode }) => (
            <div data-testid="rf-panel">{children}</div>
        ),
    };
});

const mockCalmData: CalmArchitectureSchema = {
    nodes: [
        { 'unique-id': 'node-1', name: 'Service A', description: 'A service', 'node-type': 'service' },
        { 'unique-id': 'node-2', name: 'Database B', description: 'A database', 'node-type': 'database' },
    ],
    relationships: [
        {
            'unique-id': 'rel-1',
            description: 'connects to',
            'relationship-type': {
                connects: { source: { node: 'node-1' }, destination: { node: 'node-2' } },
            },
        },
    ],
};

// Two nodes span x 0 to 300 and y 0 to 100. A callout that reaches 160 below node-1 takes the content down to y 260.
const measuredNodes = [
    { id: 'node-1', position: { x: 0, y: 0 }, positionAbsolute: { x: 0, y: 0 }, width: 200, height: 100 },
    { id: 'node-2', position: { x: 100, y: 0 }, positionAbsolute: { x: 100, y: 0 }, width: 200, height: 100 },
];
const contentWithCallout = { x: 0, y: 0, width: 300, height: 260 };

/** A flow instance with measured nodes, handed to the graph as ReactFlow's onInit would, in an 800 by 600 pane. */
function initMeasuredFlow() {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const instance = { fitView: vi.fn(), getNodes: () => measuredNodes, setViewport: vi.fn() };
    (reactFlowProps.current?.onInit as (i: unknown) => void)(instance);
    return instance;
}

const reportCallout = () => act(() => decisionOverlay.current?.reportCalloutSize('node-1', { width: 200, height: 160 }));

describe('ArchitectureGraph', () => {
    beforeEach(() => {
        reactFlowProps.current = null;
        miniMapProps.current = null;
        controlsProps.current = null;
        reactFlowMountCount = 0;
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it('floors and caps fitView zoom so dense graphs stay legible (#6)', () => {
        render(<ArchitectureGraph jsonData={mockCalmData} />);
        // minZoom floor keeps a dense graph from shrinking below readability;
        // maxZoom caps fit-to-view so a sparse graph isn't oversized.
        expect(reactFlowProps.current?.fitViewOptions).toEqual({
            padding: 0.2,
            minZoom: 0.6,
            maxZoom: 1.2,
        });
        // The pane-level minZoom still lets the user pinch out past the fit floor.
        expect(reactFlowProps.current?.minZoom).toBe(0.1);
    });

    it('restores a saved viewport (no fit) on desktop — unchanged by the mobile branch', () => {
        // Desktop must keep restore-or-fit: with a saved viewport it restores and
        // does NOT fit. This guards the desktop path against the mobile #10 change.
        // The store key is device-namespaced, so seed the desktop entry.
        sessionStorage.setItem(
            'calm-hub:diagram-viewport',
            JSON.stringify({ key: 'desktop:ns/id', viewport: { x: 5, y: 6, zoom: 0.8 } })
        );
        render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" defaultLayout={null} />);
        expect(reactFlowProps.current?.fitView).toBe(false);
        expect(reactFlowProps.current?.defaultViewport).toEqual({ x: 5, y: 6, zoom: 0.8 });
        expect(reactFlowProps.current?.fitViewOptions).toEqual({
            padding: 0.2,
            minZoom: 0.6,
            maxZoom: 1.2,
        });
    });

    it('wires onInit on desktop too, so a later desktop→mobile crossing can re-fit', () => {
        render(<ArchitectureGraph jsonData={mockCalmData} />);
        expect(typeof reactFlowProps.current?.onInit).toBe('function');
    });

    describe('fitToPane', () => {
        // The shared setup stubs ResizeObserver as a no-op. Swap in one that
        // records its callback so a pane resize can be simulated, and run
        // rAF synchronously since the refit is frame-batched.
        // Globals are saved and restored by hand. vi.unstubAllGlobals() would
        // also drop the localStorage/sessionStorage stubs from vitest.setup.ts
        // and break every test that runs after this block.
        let triggerResize: (() => void) | null;
        let originalResizeObserver: typeof globalThis.ResizeObserver;
        let originalRaf: typeof globalThis.requestAnimationFrame;
        let originalCancelRaf: typeof globalThis.cancelAnimationFrame;

        beforeEach(() => {
            triggerResize = null;
            originalResizeObserver = globalThis.ResizeObserver;
            originalRaf = globalThis.requestAnimationFrame;
            originalCancelRaf = globalThis.cancelAnimationFrame;

            globalThis.ResizeObserver = class {
                constructor(callback: ResizeObserverCallback) {
                    triggerResize = () => callback([], this as unknown as ResizeObserver);
                }
                observe() {}
                unobserve() {}
                disconnect() {}
            } as unknown as typeof globalThis.ResizeObserver;
            globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
                cb(0);
                return 1;
            }) as typeof globalThis.requestAnimationFrame;
            globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame;
        });

        afterEach(() => {
            globalThis.ResizeObserver = originalResizeObserver;
            globalThis.requestAnimationFrame = originalRaf;
            globalThis.cancelAnimationFrame = originalCancelRaf;
            vi.restoreAllMocks();
        });

        /** Hands the graph a flow instance the way ReactFlow's onInit would. */
        function initFlow() {
            const fitView = vi.fn();
            const onInit = reactFlowProps.current?.onInit as (i: unknown) => void;
            onInit({ fitView });
            return fitView;
        }

        it('drops the zoom floor so a narrow pane contains the graph instead of clipping it', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} fitToPane />);
            // The 0.6 desktop floor cannot fit this graph into a pane narrowed by
            // the commentary panel, so it overflows left/right at exactly scale 0.6.
            expect(reactFlowProps.current?.fitViewOptions).toEqual({
                padding: 0.1,
                minZoom: 0.1,
                maxZoom: 1.2,
            });
            // Always fit, never restore. Siblings size the pane, not the user.
            expect(reactFlowProps.current?.fitView).toBe(true);
            expect(reactFlowProps.current?.defaultViewport).toBeUndefined();
        });

        it('re-fits the pane on resize when enabled', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} fitToPane />);
            const fitView = initFlow();

            triggerResize?.();

            // Same options as the initial fit, so a resize does not reintroduce the
            // floor that caused the clipping.
            expect(fitView).toHaveBeenCalledWith({ padding: 0.1, minZoom: 0.1, maxZoom: 1.2 });
        });

        it('takes in the decision callouts when it re-fits the pane', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} fitToPane />);
            const instance = initMeasuredFlow();
            reportCallout();

            triggerResize?.();

            expect(instance.fitView).not.toHaveBeenCalled();
            expect(instance.setViewport).toHaveBeenCalledWith(getViewportForBounds(contentWithCallout, 800, 600, 0.1, 1.2, 0.1));
        });

        it('does not observe the pane when disabled, so a saved viewport survives a resize', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const fitView = initFlow();

            // No observer was constructed at all, so there is nothing to trigger.
            expect(triggerResize).toBeNull();
            expect(fitView).not.toHaveBeenCalled();
        });
    });

    describe('fit button', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('takes in the decision callouts, after React Flow\'s own fit of the nodes', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();
            reportCallout();

            (controlsProps.current?.onFitView as () => void)();

            // The button's own fit has the pane's zoom range and React Flow's default padding.
            expect(instance.setViewport).toHaveBeenCalledWith(getViewportForBounds(contentWithCallout, 800, 600, 0.1, 2, 0.1));
        });

        it('leaves the fit to React Flow while no callout is drawn', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();

            (controlsProps.current?.onFitView as () => void)();

            expect(instance.setViewport).not.toHaveBeenCalled();
            expect(instance.fitView).not.toHaveBeenCalled();
        });
    });

    describe('fit on load', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        // React Flow reports every move through onMove, with no event for a move made from code.
        const move = (viewport: Viewport) => act(() => (reactFlowProps.current?.onMove as (e: null, v: Viewport) => void)(null, viewport));
        // Where React Flow's own fit puts the two nodes (x 0 to 300, y 0 to 100), with the desktop load options.
        const nodesFit = getViewportForBounds({ x: 0, y: 0, width: 300, height: 100 }, 800, 600, 0.6, 1.2, 0.2);
        const calloutFit = getViewportForBounds(contentWithCallout, 800, 600, 0.1, 1.2, 0.2);
        // Anywhere else: a drag or wheel, or a move the zoom buttons, the minimap or auto-pan make from code.
        const viewersMove = { x: 12, y: 34, zoom: 0.9 };

        it('takes in the callouts drawn before React Flow hands over its instance', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            reportCallout();

            const instance = initMeasuredFlow();

            expect(instance.setViewport).toHaveBeenCalledWith(calloutFit);
        });

        it('keeps following through React Flow\'s own fit and its callout fits landing', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();
            move(nodesFit);
            reportCallout();
            move(calloutFit);

            act(() => decisionOverlay.current?.reportCalloutSize('node-1', { width: 200, height: 300 }));

            expect(instance.setViewport).toHaveBeenLastCalledWith(
                getViewportForBounds({ x: 0, y: 0, width: 300, height: 400 }, 800, 600, 0.1, 1.2, 0.2),
            );
        });

        it('zooms out past the desktop floor when the callouts would not otherwise fit, as on a small screen', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();

            // A callout reaching 2000 below node-1 takes the content down to y 2100, more than 600 / 0.6.
            act(() => decisionOverlay.current?.reportCalloutSize('node-1', { width: 200, height: 2000 }));

            const viewport = instance.setViewport.mock.lastCall?.[0] as Viewport;
            expect(viewport).toEqual(getViewportForBounds({ x: 0, y: 0, width: 300, height: 2100 }, 800, 600, 0.1, 1.2, 0.2));
            expect(viewport.zoom).toBeLessThan(0.6);
        });

        it('stops following after any move a fit did not make', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();
            move(viewersMove);

            reportCallout();

            expect(instance.setViewport).not.toHaveBeenCalled();
        });

        it('saves only the viewer\'s view, so a refresh fits again until they move the diagram', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" defaultLayout={null} />);
            initMeasuredFlow();
            move(nodesFit);
            reportCallout();
            move(calloutFit);
            expect(sessionStorage.getItem('calm-hub:diagram-viewport')).toBeNull();

            move(viewersMove);

            expect(JSON.parse(sessionStorage.getItem('calm-hub:diagram-viewport')!)).toEqual({ key: 'desktop:ns/id', viewport: viewersMove });
        });

        it('leaves a restored viewport alone', () => {
            sessionStorage.setItem(
                'calm-hub:diagram-viewport',
                JSON.stringify({ key: 'desktop:ns/id', viewport: { x: 5, y: 6, zoom: 0.8 } })
            );
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" defaultLayout={null} />);
            const instance = initMeasuredFlow();

            reportCallout();

            expect(instance.setViewport).not.toHaveBeenCalled();
        });
    });

    describe('minimap (#5)', () => {
        it('renders the minimap at a fixed compact size on desktop', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
            const style = miniMapProps.current?.style as Record<string, unknown>;
            expect(style.width).toBe(132);
            expect(style.height).toBe(84);
            expect(style.overflow).toBe('hidden');
        });

        it('gives the minimap a primary-blue viewport rect and a themed mask', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(miniMapProps.current?.maskStrokeColor).toBe('#2563EB');
            expect(miniMapProps.current?.maskStrokeWidth).toBe(1.5);
            // The mask is no longer a prop: ReactFlow writes `maskColor` into an SVG
            // `fill` attribute, which `var()` cannot reach. It opts into the themed
            // veil in index.css by class instead.
            expect(miniMapProps.current?.maskColor).toBeUndefined();
            expect(miniMapProps.current?.className).toBe('calm-minimap-mask-surface');
        });

        it('hides the minimap when toggled off and persists the choice', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /hide minimap/i }));
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
            expect(sessionStorage.getItem('calmHub.diagramMinimapHidden')).toBe('1');
        });

        it('restores the hidden minimap when toggled back on', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            fireEvent.click(screen.getByRole('button', { name: /hide minimap/i }));
            fireEvent.click(screen.getByRole('button', { name: /show minimap/i }));
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
            expect(sessionStorage.getItem('calmHub.diagramMinimapHidden')).toBe('0');
        });

        it('starts hidden when the persisted preference says so', () => {
            sessionStorage.setItem('calmHub.diagramMinimapHidden', '1');
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /show minimap/i })).toBeInTheDocument();
        });
    });

    describe('presentation mode', () => {
        let storage: Storage;
        let store: PresentationModeStore;

        beforeEach(() => {
            storage = createMemoryStorage();
            store = createPresentationModeStore(storage);
        });

        afterEach(() => {
            window.location.hash = '';
        });

        const renderGraph = () => render(<ArchitectureGraph jsonData={mockCalmData} presentationStore={store} />);
        const presentation = () => screen.getByRole('button', { name: 'Presentation mode' });

        it('starts off, with the minimap shown', () => {
            renderGraph();
            expect(presentation()).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
        });

        it('turns on, hides the minimap and is kept for the session', () => {
            renderGraph();
            fireEvent.click(presentation());
            expect(presentation()).toHaveAttribute('aria-pressed', 'true');
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
            expect(storage.getItem(PRESENTATION_MODE_KEY)).toBe('1');
        });

        it('turns off again and brings the minimap back', () => {
            renderGraph();
            fireEvent.click(presentation());
            fireEvent.click(presentation());
            expect(presentation()).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
            expect(storage.getItem(PRESENTATION_MODE_KEY)).toBe('0');
        });

        it('restores the mode kept for the session', () => {
            storage.setItem(PRESENTATION_MODE_KEY, '1');
            store = createPresentationModeStore(storage);
            renderGraph();
            expect(presentation()).toHaveAttribute('aria-pressed', 'true');
        });

        it('turns on from present=1 in the hash route, and keeps it when the query is dropped', () => {
            window.location.hash = '#/finos/architectures/33/1.1.0?present=1';
            const { unmount } = renderGraph();
            expect(presentation()).toHaveAttribute('aria-pressed', 'true');
            unmount();
            window.location.hash = '#/finos/architectures/33/1.1.0?tab=diagram';
            renderGraph();
            expect(presentation()).toHaveAttribute('aria-pressed', 'true');
        });

        it('turns a kept mode off from present=0', () => {
            store.set(true);
            window.location.hash = '#/finos/architectures/33/1.1.0?tab=diagram&present=0';
            renderGraph();
            expect(presentation()).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('decision overlay', () => {
        let storage: Storage;
        let store: PresentationModeStore;

        beforeEach(() => {
            storage = createMemoryStorage();
            store = createPresentationModeStore(createMemoryStorage());
        });

        afterEach(() => {
            window.location.hash = '';
        });

        const renderGraph = () =>
            render(<ArchitectureGraph jsonData={mockCalmData} presentationStore={store} storage={storage} />);
        const presentation = () => screen.getByRole('button', { name: 'Presentation mode' });
        const decisions = () => screen.getByRole('button', { name: 'Show decisions' });
        const shown = () => screen.getByTestId('react-flow').getAttribute('data-show-decisions');

        it('starts off', () => {
            renderGraph();
            expect(decisions()).toHaveAttribute('aria-pressed', 'false');
            expect(shown()).toBe('false');
        });

        it('switches on and off with presentation mode', () => {
            renderGraph();
            fireEvent.click(presentation());
            expect(decisions()).toHaveAttribute('aria-pressed', 'true');
            expect(shown()).toBe('true');
            fireEvent.click(presentation());
            expect(decisions()).toHaveAttribute('aria-pressed', 'false');
            expect(shown()).toBe('false');
        });

        it('switches on its own, leaving presentation mode and the minimap alone, and is kept for the session', () => {
            renderGraph();
            fireEvent.click(decisions());
            expect(shown()).toBe('true');
            expect(presentation()).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getByTestId('diagram-minimap')).toBeInTheDocument();
            expect(storage.getItem('calmHub.diagramDecisionsShown')).toBe('1');
        });

        it('can be switched off while presenting, and follows presentation mode again when that is switched', () => {
            store.set(true);
            renderGraph();
            fireEvent.click(decisions());
            expect(shown()).toBe('false');
            expect(presentation()).toHaveAttribute('aria-pressed', 'true');
            fireEvent.click(presentation());
            fireEvent.click(presentation());
            expect(shown()).toBe('true');
            expect(storage.getItem('calmHub.diagramDecisionsShown')).toBeNull();
        });

        it('restores the choice kept for the session', () => {
            storage.setItem('calmHub.diagramDecisionsShown', '1');
            renderGraph();
            expect(shown()).toBe('true');
            expect(presentation()).toHaveAttribute('aria-pressed', 'false');
        });

        it('turns on with present=1, over a choice kept for the session', () => {
            storage.setItem('calmHub.diagramDecisionsShown', '0');
            window.location.hash = '#/finos/architectures/33/1.1.0?present=1';
            renderGraph();
            expect(shown()).toBe('true');
        });

        it('gives the diagram the elements\' display names, a relationship by its nodes', () => {
            renderGraph();
            expect(screen.getByTestId('react-flow')).toHaveAttribute('data-relationship-label', 'Service A → Database B');
        });
    });

    describe('animation toggle', () => {
        it('offers a pause-animation control on desktop', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.getByRole('button', { name: /pause animation/i })).toBeInTheDocument();
        });
    });

    describe('mobile', () => {
        const originalMatchMedia = window.matchMedia;
        function mockMobileViewport() {
            window.matchMedia = (query: string) =>
                ({
                    matches: query.includes('max-width: 1023px'),
                    media: query,
                    onchange: null,
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    addListener: () => {},
                    removeListener: () => {},
                    dispatchEvent: () => false,
                }) as unknown as MediaQueryList;
        }
        afterEach(() => {
            // Restore the default (desktop) matchMedia so later tests aren't left mobile.
            window.matchMedia = originalMatchMedia;
            vi.restoreAllMocks();
        });

        it('omits the minimap on mobile (Frame F shows no minimap)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
        });

        it('has no pause-animation control on mobile, where the OS setting applies', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.queryByRole('button', { name: /pause animation/i })).not.toBeInTheDocument();
        });

        it('renders visible zoom controls on mobile (#11)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            // Controls now render on mobile too (they were desktop-only before).
            expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
        });

        it('always fits the view on load on mobile, ignoring any saved viewport (#10)', () => {
            // Seed a saved viewport under the mobile-namespaced key; mobile must still
            // fit (not restore) so a dense graph fits 390px rather than overflow.
            sessionStorage.setItem(
                'calm-hub:diagram-viewport',
                JSON.stringify({ key: 'mobile:ns/id', viewport: { x: 0, y: 0, zoom: 1 } })
            );
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" defaultLayout={null} />);
            expect(reactFlowProps.current?.fitView).toBe(true);
            expect(reactFlowProps.current?.defaultViewport).toBeUndefined();
            // Floor drops to the pane minZoom (0.1) + tighter padding so even a wide
            // dense graph (e.g. TraderX fits 390px only at ~0.16) isn't clipped.
            expect(reactFlowProps.current?.fitViewOptions).toEqual({
                padding: 0.1,
                minZoom: 0.1,
                maxZoom: 1.2,
            });
        });

        it('captures the instance via onInit on mobile and re-fits on viewport resize (#10)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);

            // onInit is wired on both devices (captured here on mobile) so a resize can re-fit.
            const onInit = reactFlowProps.current?.onInit as
                | ((i: { fitView: (o?: unknown) => void }) => void)
                | undefined;
            expect(typeof onInit).toBe('function');

            const fitView = vi.fn();
            onInit?.({ fitView });

            // A viewport resize re-fits with the mobile options so the graph keeps
            // fitting 390px after rotation / iOS chrome collapse.
            window.dispatchEvent(new Event('resize'));
            expect(fitView).toHaveBeenCalledWith({ padding: 0.1, minZoom: 0.1, maxZoom: 1.2 });
        });

        it('takes in the decision callouts when it re-fits on a resize, and with its fit button', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            const instance = initMeasuredFlow();
            reportCallout();
            const fit = getViewportForBounds(contentWithCallout, 800, 600, 0.1, 1.2, 0.1);

            window.dispatchEvent(new Event('resize'));
            expect(instance.setViewport).toHaveBeenLastCalledWith(fit);

            instance.setViewport.mockClear();
            (controlsProps.current?.onFitView as () => void)();
            expect(instance.setViewport).toHaveBeenCalledWith(fit);
            expect(instance.fitView).not.toHaveBeenCalled();
        });
    });

    describe('default layout precedence', () => {
        const key = 'ns/id';

        function nodePosition(id: string) {
            const nodes = reactFlowProps.current?.nodes as Node[] | undefined;
            return nodes?.find((n) => n.id === id)?.position;
        }

        it('applies local scratch over the default layout when both exist', () => {
            saveNodePositions(key, [{ id: 'node-1', position: { x: 111, y: 222 }, data: {} }] as Node[]);

            render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 999, y: 999 } }]}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 111, y: 222 });
        });

        it('applies the server default when no local scratch is stored', () => {
            render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('falls back to the auto-layout when neither scratch nor a server default exist', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey={key} defaultLayout={null} />);

            // No loading gate, no forced position — the graph renders with dagre's own layout.
            expect(screen.getByTestId('react-flow')).toBeInTheDocument();
            expect(nodePosition('node-1')).toBeDefined();
        });

        it('shows a loading placeholder and withholds the graph while the server default is still loading', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey={key} defaultLayout={undefined} />);

            expect(screen.getByText('Loading saved layout…')).toBeInTheDocument();
            expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
        });

        it('does not gate on a missing viewportKey (e.g. a dropped file) even with defaultLayout undefined', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} defaultLayout={undefined} />);

            expect(screen.getByTestId('react-flow')).toBeInTheDocument();
        });

        it('falls back to scratch when no default layout is provided, then applies default on epoch bump after scratch is cleared', () => {
            saveNodePositions(key, [{ id: 'node-1', position: { x: 111, y: 222 }, data: {} }] as Node[]);

            const { rerender } = render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={null}
                    layoutEpoch={0}
                />
            );
            expect(nodePosition('node-1')).toEqual({ x: 111, y: 222 });

            // Simulate save/reset: scratch is cleared before the epoch bumps.
            clearStoredNodePositions(key);
            rerender(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                    layoutEpoch={1}
                />
            );

            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('does not remount ReactFlow on a layoutEpoch bump, so the current viewport survives a save/reset', () => {
            // The ReactFlow `key` used to fold in layoutEpoch, forcing a remount on
            // every reset. But savedViewport is memoised on storageKey alone (never
            // recomputed by an epoch bump), so a remount restored defaultViewport
            // from whatever was read at *mount* time, not the user's current pan/
            // zoom — the canvas would snap back on every save. The remount was never
            // needed for positions: the parse effect already has layoutEpoch in its
            // own deps and re-applies on its own (proved by the test above).
            const { rerender } = render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 5, y: 6 } }]}
                    layoutEpoch={0}
                />
            );
            const instanceBefore = screen.getByTestId('react-flow').getAttribute('data-instance');

            rerender(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 333, y: 444 } }]}
                    layoutEpoch={1}
                />
            );

            expect(screen.getByTestId('react-flow').getAttribute('data-instance')).toBe(instanceBefore);
            expect(nodePosition('node-1')).toEqual({ x: 333, y: 444 });
        });

        it('reports applied positions upward via onPositionsChange', () => {
            const onPositionsChange = vi.fn();
            render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={[{ id: 'node-1', position: { x: 5, y: 6 } }]}
                    onPositionsChange={onPositionsChange}
                />
            );

            expect(onPositionsChange).toHaveBeenCalled();
            const reported = onPositionsChange.mock.calls.at(-1)?.[0];
            expect(reported.find((p: { id: string }) => p.id === 'node-1')?.position).toEqual({ x: 5, y: 6 });
        });

        it('does not re-run the parse effect when onPositionsChange gets a new identity', () => {
            // Held stable across rerenders — a fresh array literal per render would
            // itself be a real dependency change (defaultLayout) and confound the
            // thing under test.
            const stableDefaultLayout = [{ id: 'node-1', position: { x: 5, y: 6 } }];

            const firstCallback = vi.fn();
            const { rerender } = render(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={firstCallback}
                />
            );
            expect(firstCallback).toHaveBeenCalledTimes(1);

            // Same props except a brand-new function identity — as a naive inline
            // arrow at a call site would produce. The parse effect must not treat
            // this as a real dependency change: no second parse-and-apply, and no
            // call to the stale first callback.
            const secondCallback = vi.fn();
            rerender(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={secondCallback}
                />
            );

            expect(firstCallback).toHaveBeenCalledTimes(1);
            expect(secondCallback).not.toHaveBeenCalled();

            // The next genuine re-apply (layoutEpoch bump) reports through the
            // *current* callback, proving the ref is kept up to date.
            rerender(
                <ArchitectureGraph
                    jsonData={mockCalmData}
                    viewportKey={key}
                    defaultLayout={stableDefaultLayout}
                    onPositionsChange={secondCallback}
                    layoutEpoch={1}
                />
            );
            expect(secondCallback).toHaveBeenCalledTimes(1);
            expect(firstCallback).toHaveBeenCalledTimes(1);
        });
    });
});
