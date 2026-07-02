import { describe, it, expect, vi, beforeEach } from 'vitest';
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

        it('omits the minimap and its toggle on mobile (Phase 5 owns mobile diagram)', () => {
            mockMobileViewport();
            render(<ArchitectureGraph jsonData={mockCalmData} />);
            expect(screen.queryByTestId('diagram-minimap')).not.toBeInTheDocument();
            expect(screen.queryByTestId('rf-controls')).not.toBeInTheDocument();
        });
    });
});
