import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingEdge } from './FloatingEdge.js';
import { THEME } from './theme.js';
import { PRESENTATION_MODE_KEY } from '../../context/presentationMode.js';

const { bezier, smoothStep, straight, edgeParams, storeNodes } = vi.hoisted(() => ({
    storeNodes: new Map<string, object>(),
    bezier: vi.fn(() => ['M bezier', 11, 12]),
    smoothStep: vi.fn(() => ['M smoothstep', 21, 22]),
    straight: vi.fn(() => ['M straight', 31, 32]),
    edgeParams: vi.fn(),
}));

vi.mock('reactflow', () => ({
    getBezierPath: bezier,
    getSmoothStepPath: smoothStep,
    getStraightPath: straight,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div data-testid="label-renderer">{children}</div>,
    useStore: (selector: (store: { nodeInternals: Map<string, object> }) => unknown) =>
        selector({ nodeInternals: new Map([['a', { id: 'a' }], ['b', { id: 'b' }], ...storeNodes]) }),
}));

vi.mock('./utils/floatingEdges.js', () => ({ getEdgeParams: edgeParams }));

vi.mock('./edge-components/index.js', () => ({
    EdgeBadge: () => <span data-testid="edge-badge" />,
    EdgeTooltip: () => <div data-testid="edge-tooltip" />,
    getBadgeStyle: () => ({ background: '', border: '', iconColor: '' }),
}));

// Floating positions differ from the native handle positions on purpose, so a test can tell
// which of the two an edge was routed from.
const FLOATING = { sx: 100, sy: 110, tx: 200, ty: 210, sourcePos: 'left', targetPos: 'right' };

type EdgeComponentProps = ComponentProps<typeof FloatingEdge>;

function edgeProps(overrides: Record<string, unknown> = {}): EdgeComponentProps {
    return {
        id: 'e1',
        source: 'a',
        target: 'b',
        sourceX: 1,
        sourceY: 2,
        targetX: 3,
        targetY: 4,
        sourcePosition: 'bottom',
        targetPosition: 'top',
        ...overrides,
    } as unknown as EdgeComponentProps;
}

function renderEdge(data?: Record<string, unknown>) {
    return render(
        <svg>
            <FloatingEdge {...edgeProps({ data })} />
        </svg>
    );
}

describe('FloatingEdge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        edgeParams.mockReturnValue(FLOATING);
    });

    describe('routing', () => {
        it('draws a bezier path by default', () => {
            const { container } = renderEdge({ description: 'd' });

            expect(bezier).toHaveBeenCalledOnce();
            expect(smoothStep).not.toHaveBeenCalled();
            expect(straight).not.toHaveBeenCalled();
            expect(container.querySelector('path')?.getAttribute('d')).toBe('M bezier');
        });

        it('draws a smoothstep path from the floating positions, not the node handles', () => {
            const { container } = renderEdge({ metadata: { routing: 'smoothstep' } });

            expect(smoothStep).toHaveBeenCalledWith(expect.objectContaining({
                sourceX: 100, sourceY: 110, sourcePosition: 'left',
                targetX: 200, targetY: 210, targetPosition: 'right',
            }));
            expect(bezier).not.toHaveBeenCalled();
            expect(container.querySelector('path')?.getAttribute('d')).toBe('M smoothstep');
        });

        it('draws a straight path from the floating positions, not the node handles', () => {
            const { container } = renderEdge({ metadata: { routing: 'straight' } });

            expect(straight).toHaveBeenCalledWith(expect.objectContaining({
                sourceX: 100, sourceY: 110, targetX: 200, targetY: 210,
            }));
            expect(bezier).not.toHaveBeenCalled();
            expect(container.querySelector('path')?.getAttribute('d')).toBe('M straight');
        });

        it('falls back to bezier for an unrecognised routing value', () => {
            renderEdge({ metadata: { routing: 'zigzag' } });

            expect(bezier).toHaveBeenCalledOnce();
        });

        it('draws nothing when a node is missing from the store', () => {
            const { container } = render(
                <svg>
                    <FloatingEdge {...edgeProps({ target: 'missing', data: {} })} />
                </svg>
            );

            expect(container.querySelector('path')).toBeNull();
        });
    });

    describe('label and badge', () => {
        it('shows the description as a text label without a badge', () => {
            renderEdge({ description: 'Calls the ledger' });

            expect(screen.getByText('Calls the ledger')).toBeInTheDocument();
            expect(screen.queryByTestId('edge-badge')).toBeNull();
        });

        it('styles the label from the theme tokens', () => {
            renderEdge({ description: 'Calls the ledger' });
            const label = screen.getByText('Calls the ledger');

            expect(label.style.background).toBe(THEME.colors.card);
            expect(label.style.border).toContain(THEME.colors.border);
            expect(label.style.color).toBe(THEME.colors.muted);
        });

        it('falls back to the protocol as the label', () => {
            renderEdge({ protocol: 'HTTPS' });

            expect(screen.getByText('HTTPS')).toBeInTheDocument();
        });

        it('shows a badge for AIGF metadata even with no label text', () => {
            renderEdge({ metadata: { aigf: { risks: ['prompt-injection'] } } });

            expect(screen.getByTestId('edge-badge')).toBeInTheDocument();
        });

        it('shows a badge for flow transitions even with no label text', () => {
            renderEdge({ flowTransitions: [{ sequenceNumber: 1 }] });

            expect(screen.getByTestId('edge-badge')).toBeInTheDocument();
        });

        it('renders no label area for an edge with nothing to show', () => {
            renderEdge({});

            expect(screen.queryByTestId('label-renderer')).toBeNull();
        });
    });

    describe('hover tooltip', () => {
        it('shows the tooltip while the pointer is over the label and hides it after', () => {
            renderEdge({ description: 'Calls the ledger' });
            const label = screen.getByText('Calls the ledger');

            fireEvent.mouseEnter(label.parentElement as HTMLElement);
            expect(screen.getByTestId('edge-tooltip')).toBeInTheDocument();

            fireEvent.mouseLeave(label.parentElement as HTMLElement);
            expect(screen.queryByTestId('edge-tooltip')).toBeNull();
        });
    });
});

describe('FloatingEdge in presentation mode', () => {
    beforeEach(() => {
        edgeParams.mockReturnValue(FLOATING);
        storeNodes.clear();
        sessionStorage.clear();
    });

    const renderEdge = () => render(
        <svg>
            <FloatingEdge {...edgeProps({ data: { 'unique-id': 'rel-1', description: 'writes' } })} />
        </svg>
    );
    const labelBox = () => screen.getByText('writes').parentElement as HTMLElement;

    it('makes the label larger and stacks it under the badge', () => {
        sessionStorage.setItem(PRESENTATION_MODE_KEY, '1');
        renderEdge();
        expect(screen.getByText('writes').style.fontSize).toBe('16px');
        expect(labelBox().style.flexDirection).toBe('column');
    });

    it('moves the label above a node it would cover, only in presentation mode', () => {
        // The mocked bezier puts the label at (11, 12), inside this node.
        storeNodes.set('middle', { id: 'middle', type: 'custom', width: 50, height: 50, positionAbsolute: { x: 0, y: 4 } });

        const { unmount } = renderEdge();
        expect(screen.getByText('writes').style.fontSize).toBe('10px');
        expect(labelBox().style.transform).toBe('translate(-50%, -50%) translate(11px,12px)');
        unmount();

        sessionStorage.setItem(PRESENTATION_MODE_KEY, '1');
        renderEdge();
        expect(labelBox().style.transform).toBe('translate(-50%, -100%) translate(11px,-4px)');
    });
});
