import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingEdge } from './FloatingEdge.js';
import { THEME } from './theme.js';
import { createPresentationModeStore } from '../../../theme/usePresentationMode.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { ControlEvaluationContext } from '../../context/ControlEvaluationContext.js';
import { DecisionOverlayContext } from '../../context/DecisionOverlayContext.js';
import type { ElementEvaluation } from '../../contracts/contracts.js';

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

vi.mock('./utils/floatingEdges.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./utils/floatingEdges.js')>()),
    getEdgeParams: edgeParams,
}));

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

function evaluationFor(status: 'met' | 'not-met'): ElementEvaluation {
    return {
        status,
        latest: [{
            schema: 's', uniqueId: 'eval-1', type: 'control-evaluation', target: ['t'], appliesTo: ['rel-1'],
            data: { control: { 'unique-id': 'client-ledger-human-approval', 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': '2026-11-04T15:00:00Z' },
        }],
    };
}

function renderEdgeWithEvaluation(status: 'met' | 'not-met', style: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return render(
        <ControlEvaluationContext.Provider value={new Map([['rel-1', evaluationFor(status)]])}>
            <svg>
                <FloatingEdge {...edgeProps({ style, data: { 'unique-id': 'rel-1', description: 'writes' }, ...extra })} />
            </svg>
        </ControlEvaluationContext.Provider>
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

    describe('control evaluations', () => {
        const STROKE = '#123456';
        // jsdom reads a stroke back in its normalised form, such as rgb(...), not as it was set.
        const css = (colour: string) => {
            const el = document.createElement('div');
            el.style.stroke = colour;
            return el.style.stroke;
        };

        it('draws a not-met relationship red, with a Not met label', () => {
            const { container } = renderEdgeWithEvaluation('not-met', { stroke: STROKE });
            const path = container.querySelector('path.react-flow__edge-path') as SVGPathElement;

            expect(path.style.stroke).toBe(css(THEME.colors.error));
            expect(screen.getByTestId('edge-evaluation-badge').textContent).toContain('Not met');
        });

        it('leaves a met relationship as it was', () => {
            const { container } = renderEdgeWithEvaluation('met', { stroke: STROKE });
            const path = container.querySelector('path.react-flow__edge-path') as SVGPathElement;

            expect(path.style.stroke).toBe(css(STROKE));
            expect(screen.queryByTestId('edge-evaluation-badge')).toBeNull();
        });

        it('labels a not-met relationship at 11px, with the glyph hidden from assistive technology', () => {
            renderEdgeWithEvaluation('not-met', { stroke: STROKE });
            const badge = screen.getByTestId('edge-evaluation-badge');

            expect(badge.style.fontSize).toBe('11px');
            expect(badge.style.color).toBe(THEME.colors.errorText);
            expect(screen.getByText('✗').getAttribute('aria-hidden')).toBe('true');
        });

        it('points a not-met relationship\'s arrowheads at its own red marker', () => {
            const { container } = renderEdgeWithEvaluation('not-met', { stroke: STROKE }, { markerEnd: 'url(#default-end)', markerStart: 'url(#default-start)' });
            const path = container.querySelector('path.react-flow__edge-path') as SVGPathElement;
            const marker = container.querySelector('marker#control-evaluation-arrow-e1') as SVGMarkerElement;

            expect(marker).not.toBeNull();
            expect(marker.querySelector('polyline')?.getAttribute('fill')).toBe(THEME.colors.error);
            expect(path.getAttribute('marker-end')).toBe('url(#control-evaluation-arrow-e1)');
            expect(path.getAttribute('marker-start')).toBe('url(#control-evaluation-arrow-e1)');
        });

        it('keeps a met relationship\'s arrowheads, and adds no marker', () => {
            const { container } = renderEdgeWithEvaluation('met', { stroke: STROKE }, { markerEnd: 'url(#default-end)' });
            const path = container.querySelector('path.react-flow__edge-path') as SVGPathElement;

            expect(container.querySelector('marker')).toBeNull();
            expect(path.getAttribute('marker-end')).toBe('url(#default-end)');
            expect(path.hasAttribute('marker-start')).toBe(false);
        });

        it('adds no arrowhead to a not-met relationship drawn without one', () => {
            const { container } = renderEdgeWithEvaluation('not-met', { stroke: STROKE });
            const path = container.querySelector('path.react-flow__edge-path') as SVGPathElement;

            expect(path.hasAttribute('marker-end')).toBe(false);
            expect(path.hasAttribute('marker-start')).toBe(false);
        });

        it('gives a not-met relationship with only an end arrowhead no start arrowhead, as ReactFlow passes an unset start as url(\'#\')', () => {
            const { container } = render(
                <ControlEvaluationContext.Provider value={new Map([['rel-1', evaluationFor('not-met')]])}>
                    <svg>
                        <FloatingEdge {...edgeProps({
                            style: { stroke: STROKE },
                            markerEnd: "url('#default-end')",
                            markerStart: "url('#')",
                            data: { 'unique-id': 'rel-1', description: 'writes', flowActive: true },
                        })} />
                    </svg>
                </ControlEvaluationContext.Provider>
            );
            const paths = Array.from(container.querySelectorAll('path'));
            const redMarker = 'url(#control-evaluation-arrow-e1)';

            expect(paths.length).toBe(2);
            expect(paths.some((p) => p.getAttribute('marker-end') === redMarker)).toBe(true);
            paths.forEach((p) => {
                expect(p.hasAttribute('marker-start')).toBe(false);
                const references = Array.from(p.attributes).filter((a) => a.value === redMarker).map((a) => a.name);
                expect(references.every((name) => name === 'marker-end')).toBe(true);
            });
        });
    });
});

describe('FloatingEdge in presentation mode', () => {
    beforeEach(() => {
        edgeParams.mockReturnValue(FLOATING);
        storeNodes.clear();
    });

    const renderEdge = (presenting: boolean) => {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(presenting);
        return render(
            <svg>
                <FloatingEdge {...edgeProps({ data: { 'unique-id': 'rel-1', description: 'writes' } })} presentationStore={store} />
            </svg>
        );
    };
    const labelBox = () => screen.getByText('writes').parentElement as HTMLElement;

    it('makes the label larger and stacks it under the badge', () => {
        renderEdge(true);
        expect(screen.getByText('writes').style.fontSize).toBe('16px');
        expect(labelBox().style.flexDirection).toBe('column');
    });

    it('enlarges a not-met badge', () => {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(true);
        render(
            <ControlEvaluationContext.Provider value={new Map([['rel-1', evaluationFor('not-met')]])}>
                <svg>
                    <FloatingEdge {...edgeProps({ data: { 'unique-id': 'rel-1', description: 'writes' } })} presentationStore={store} />
                </svg>
            </ControlEvaluationContext.Provider>
        );
        expect(screen.getByTestId('edge-evaluation-badge').style.fontSize).toBe('18px');
    });

    it('moves the label above a node it would cover, only in presentation mode', () => {
        // The mocked bezier puts the label at (11, 12), inside this node.
        storeNodes.set('middle', { id: 'middle', type: 'custom', width: 50, height: 50, positionAbsolute: { x: 0, y: 4 } });

        const { unmount } = renderEdge(false);
        expect(screen.getByText('writes').style.fontSize).toBe('10px');
        expect(labelBox().style.transform).toBe('translate(-50%, -50%) translate(11px,12px)');
        unmount();

        renderEdge(true);
        expect(labelBox().style.transform).toBe('translate(-50%, -100%) translate(11px,-4px)');
    });
});

describe('FloatingEdge with the decision overlay', () => {
    beforeEach(() => {
        edgeParams.mockReturnValue(FLOATING);
        storeNodes.clear();
    });

    const notMetWithFinding = (): ElementEvaluation => ({
        status: 'not-met',
        latest: [{
            schema: 's', uniqueId: 'eval-1', type: 'control-evaluation', target: ['t'], appliesTo: ['rel-1'],
            data: {
                control: { 'unique-id': 'client-ledger-human-approval', 'requirement-url': 'https://example.org/r' },
                status: 'not-met',
                'evaluated-at': '2026-11-04T15:00:00Z',
                findings: [{ subject: 'rel-1', description: 'A human approved this change', cause: 'absent' }],
            },
        }],
    });

    function renderOverlay(showDecisions: boolean, evaluation: ElementEvaluation, presenting = false) {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(presenting);
        return render(
            <DecisionOverlayContext.Provider value={{ showDecisions, subjectLabels: new Map() }}>
                <ControlEvaluationContext.Provider value={new Map([['rel-1', evaluation]])}>
                    <svg>
                        <FloatingEdge {...edgeProps({ data: { 'unique-id': 'rel-1', description: 'writes' } })} presentationStore={store} />
                    </svg>
                </ControlEvaluationContext.Provider>
            </DecisionOverlayContext.Provider>
        );
    }

    it('says what a not-met relationship requires only while the overlay is on', () => {
        const { unmount } = renderOverlay(false, notMetWithFinding());
        expect(screen.queryByTestId('edge-decision-finding')).toBeNull();
        unmount();
        renderOverlay(true, notMetWithFinding());
        expect(screen.getByTestId('edge-decision-finding').textContent).toBe('Requires: A human approved this change');
    });

    it('adds nothing to a met relationship', () => {
        renderOverlay(true, evaluationFor('met'));
        expect(screen.queryByTestId('edge-decision-finding')).toBeNull();
    });

    it('enlarges the finding in presentation mode', () => {
        renderOverlay(true, notMetWithFinding(), true);
        expect(screen.getByTestId('edge-decision-finding').style.fontSize).toBe('16px');
    });
});
