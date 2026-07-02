import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CalmArchitectureSchema } from '@finos/calm-models/types';
import { ArchitectureGraph } from './ArchitectureGraph';

/**
 * Capture the props ReactFlow and MiniMap are rendered with, and render
 * Controls' children so the minimap toggle button is reachable. The real
 * ReactFlow is heavy and DOM-measurement dependent, so we stub it but keep the
 * props we assert on observable.
 */
const reactFlowProps: { current: Record<string, unknown> | null } = { current: null };
const miniMapProps: { current: Record<string, unknown> | null } = { current: null };

vi.mock('reactflow', async () => {
    // Keep the real hooks (useNodesState/useEdgesState/useStore) so the graph's
    // node state populates as it does in production; stub only the heavy,
    // DOM-measuring view components and capture their props.
    const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: (props: Record<string, unknown>) => {
            reactFlowProps.current = props;
            return <div data-testid="react-flow">{props.children as ReactNode}</div>;
        },
        Background: () => <div data-testid="rf-background" />,
        Controls: ({ children }: { children?: ReactNode }) => (
            <div data-testid="rf-controls">{children}</div>
        ),
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

describe('ArchitectureGraph', () => {
    beforeEach(() => {
        reactFlowProps.current = null;
        miniMapProps.current = null;
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
        sessionStorage.setItem(
            'calm-hub:diagram-viewport',
            JSON.stringify({ key: 'ns/id', viewport: { x: 5, y: 6, zoom: 0.8 } })
        );
        render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" />);
        expect(reactFlowProps.current?.fitView).toBe(false);
        expect(reactFlowProps.current?.defaultViewport).toEqual({ x: 5, y: 6, zoom: 0.8 });
        expect(reactFlowProps.current?.fitViewOptions).toEqual({
            padding: 0.2,
            minZoom: 0.6,
            maxZoom: 1.2,
        });
    });

    it('does not wire onInit on desktop (the resize re-fit is mobile-only)', () => {
        render(<ArchitectureGraph jsonData={mockCalmData} />);
        expect(reactFlowProps.current?.onInit).toBeUndefined();
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

        it('gives the minimap a primary-blue viewport rect and a light mask', () => {
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(miniMapProps.current?.maskStrokeColor).toBe('#2563EB');
            expect(miniMapProps.current?.maskStrokeWidth).toBe(1.5);
            // Light (~25%) mask via the existing `${color}AA` alpha-suffix pattern.
            expect(String(miniMapProps.current?.maskColor)).toMatch(/^#F8FAFC40$/i);
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
        });

        it('omits the minimap on mobile (Frame F shows no minimap)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
        });

        it('renders visible zoom controls on mobile (#11)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            // Controls now render on mobile too (they were desktop-only before).
            expect(screen.getByTestId('rf-controls')).toBeInTheDocument();
        });

        it('always fits the view on load on mobile, ignoring any saved viewport (#10)', () => {
            // Seed a saved viewport so the desktop path would restore (not fit) it;
            // mobile must still fit so a dense graph fits 390px rather than overflow.
            sessionStorage.setItem(
                'calm-hub:diagram-viewport',
                JSON.stringify({ key: 'ns/id', viewport: { x: 0, y: 0, zoom: 1 } })
            );
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} viewportKey="ns/id" />);
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

            // onInit is wired only on mobile so a resize can re-fit.
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
    });
});
