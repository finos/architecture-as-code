import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomNode } from './CustomNode.js';
import { DiagramActionsContext } from '../../context/DiagramActionsContext.js';
import { restoreLocation, setHostname } from '../../../test-support/window-location.js';
import { createPresentationModeStore } from '../../../theme/usePresentationMode.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { mockOffsetSize } from '../../../test-support/layout-mocks.js';
import { THEME, getRiskLevelColor, getNodeTypeColor } from './theme.js';
import { ControlEvaluationContext } from '../../context/ControlEvaluationContext.js';
import { DecisionOverlayContext } from '../../context/DecisionOverlayContext.js';
import type { ElementEvaluation, ControlEvaluationDecorator } from '../../contracts/contracts.js';

const { storeNodes } = vi.hoisted(() => ({ storeNodes: new Map<string, object>() }));

vi.mock('reactflow', () => ({
    Handle: () => null,
    Position: { Right: 'right', Left: 'left' },
    // The decision callout is drawn in the edge-label layer, from its node's bounds in the store.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div data-testid="label-renderer">{children}</div>,
    useStore: (selector: (store: { nodeInternals: Map<string, object> }) => unknown) => selector({ nodeInternals: storeNodes }),
}));

function makeNodeProps(details?: Record<string, unknown>, extraData: Record<string, unknown> = {}) {
    return {
        id: 'node-1',
        type: 'custom',
        selected: false,
        zIndex: 0,
        isConnectable: true,
        xPos: 0,
        yPos: 0,
        dragging: false,
        data: {
            label: 'Test Node',
            description: 'A test node',
            'node-type': 'service',
            details,
            ...extraData,
        },
    };
}

function renderNode(props: ReturnType<typeof makeNodeProps>, onNavigateToDetailedArch?: (ref: string) => void) {
    return render(
        <DiagramActionsContext.Provider value={{ onNavigateToDetailedArch }}>
            <CustomNode {...props} />
        </DiagramActionsContext.Provider>
    );
}

describe('CustomNode — external URL support', () => {
    let openSpy: ReturnType<typeof vi.fn>;
    const originalOpen = window.open;

    beforeEach(() => {
        openSpy = vi.fn();
        window.open = openSpy as unknown as typeof window.open;
    });

    afterEach(() => {
        window.open = originalOpen;
        restoreLocation();
    });

    function hoverNode() {
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
    }

    it('renders "Open Architecture" button and auth warning for https:// URLs on a different hostname', () => {
        const props = makeNodeProps({ 'detailed-architecture': 'https://calm-hub.example.com/architectures/my-arch' });
        renderNode(props);

        hoverNode();
        expect(screen.getByText('Open Architecture')).toBeInTheDocument();
        expect(screen.getByText('External resource — may require authentication')).toBeInTheDocument();
    });

    it('opens the URL in a new tab when "Open Architecture" is clicked', () => {
        const url = 'https://calm-hub.example.com/architectures/my-arch';
        const props = makeNodeProps({ 'detailed-architecture': url });
        renderNode(props);

        hoverNode();
        fireEvent.click(screen.getByText('Open Architecture'));

        expect(openSpy).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    });

    it('renders "Explore Architecture" for same-hostname absolute URLs even on a different port', () => {
        setHostname('localhost');
        const navigate = vi.fn();
        const props = makeNodeProps({ 'detailed-architecture': 'http://localhost:8080/calm/namespaces/finos/architectures/my-arch/versions/1.0.0' });
        renderNode(props, navigate);

        hoverNode();
        expect(screen.getByText('Explore Architecture')).toBeInTheDocument();
        expect(screen.queryByText('Open Architecture')).not.toBeInTheDocument();
    });

    it('calls onNavigateToDetailedArch with only the pathname for same-hostname absolute URLs', () => {
        setHostname('localhost');
        const navigate = vi.fn();
        const props = makeNodeProps({ 'detailed-architecture': 'http://localhost:8080/calm/namespaces/finos/architectures/my-arch/versions/1.0.0' });
        renderNode(props, navigate);

        hoverNode();
        fireEvent.click(screen.getByText('Explore Architecture'));

        expect(navigate).toHaveBeenCalledWith('/calm/namespaces/finos/architectures/my-arch/versions/1.0.0');
        expect(openSpy).not.toHaveBeenCalled();
    });

    it('renders "Explore Architecture" (not "Open Architecture") for same-hostname URLs with a malformed hub path', () => {
        setHostname('localhost');
        const props = makeNodeProps({ 'detailed-architecture': 'http://localhost:8080/calm/namespaces/finos/architectures/versions/1.0.0' });
        renderNode(props, vi.fn());

        hoverNode();
        expect(screen.getByText('Explore Architecture')).toBeInTheDocument();
        expect(screen.queryByText('Open Architecture')).not.toBeInTheDocument();
    });

    it('navigates in-app (never window.open) for same-hostname URLs with a malformed hub path', () => {
        setHostname('localhost');
        const navigate = vi.fn();
        const props = makeNodeProps({ 'detailed-architecture': 'http://localhost:8080/calm/namespaces/finos/architectures/versions/1.0.0' });
        renderNode(props, navigate);

        hoverNode();
        fireEvent.click(screen.getByText('Explore Architecture'));

        expect(navigate).toHaveBeenCalledWith('/calm/namespaces/finos/architectures/versions/1.0.0');
        expect(openSpy).not.toHaveBeenCalled();
    });

    it('renders "Open Architecture" for http:// URLs on a different hostname', () => {
        setHostname('localhost');
        const props = makeNodeProps({ 'detailed-architecture': 'http://calm-hub.other.com/calm/namespaces/finos/architectures/my-arch/versions/1.0.0' });
        renderNode(props);

        hoverNode();
        expect(screen.getByText('Open Architecture')).toBeInTheDocument();
        expect(screen.queryByText('Explore Architecture')).not.toBeInTheDocument();
    });

    it('renders "Explore Architecture" for legacy /calm/ paths', () => {
        const navigate = vi.fn();
        const props = makeNodeProps({ 'detailed-architecture': '/calm/namespaces/finos/architectures/my-arch/versions/1-0-0' });
        renderNode(props, navigate);

        hoverNode();
        expect(screen.getByText('Explore Architecture')).toBeInTheDocument();
        expect(screen.queryByText('Open Architecture')).not.toBeInTheDocument();
    });

    it('calls onNavigateToDetailedArch for legacy /calm/ paths', () => {
        const navigate = vi.fn();
        const path = '/calm/namespaces/finos/architectures/my-arch/versions/1-0-0';
        const props = makeNodeProps({ 'detailed-architecture': path });
        renderNode(props, navigate);

        hoverNode();
        fireEvent.click(screen.getByText('Explore Architecture'));

        expect(navigate).toHaveBeenCalledWith(path);
        expect(openSpy).not.toHaveBeenCalled();
    });

    it('does not render either architecture button when no detailed-architecture is set', () => {
        const props = makeNodeProps();
        renderNode(props);

        hoverNode();
        expect(screen.queryByText('Explore Architecture')).not.toBeInTheDocument();
        expect(screen.queryByText('Open Architecture')).not.toBeInTheDocument();
    });

    it('suppresses the drill-down indicator for an unresolvable ref (bare filename)', () => {
        const props = makeNodeProps({ 'detailed-architecture': 'api-platform.json' });
        renderNode(props);

        // No "Has detailed architecture" badge is advertised when there is no action for it.
        expect(screen.queryByTitle('Has detailed architecture')).not.toBeInTheDocument();
    });

    it('surfaces the raw ref (no button) in the hover panel for an unresolvable ref', () => {
        const props = makeNodeProps({ 'detailed-architecture': 'api-platform.json' });
        renderNode(props);

        hoverNode();
        expect(screen.getByText('Detailed Architecture:')).toBeInTheDocument();
        expect(screen.getByText('api-platform.json')).toBeInTheDocument();
        expect(screen.queryByText('Explore Architecture')).not.toBeInTheDocument();
        expect(screen.queryByText('Open Architecture')).not.toBeInTheDocument();
    });

    it('shows the drill-down indicator for a resolvable internal ref', () => {
        const props = makeNodeProps({ 'detailed-architecture': '/calm/namespaces/finos/architectures/my-arch/versions/1-0-0' });
        renderNode(props, vi.fn());

        expect(screen.getByTitle('Has detailed architecture')).toBeInTheDocument();
    });

    describe('standard-node-style metadata', () => {
        const BLOCK_BLUE = '#1C4587';

        // Round-trips a colour through the DOM so hex and rgb() spellings compare equal.
        function normalisedColor(color: string): string {
            const probe = document.createElement('div');
            probe.style.color = color;
            return probe.style.color;
        }

        function renderStyled(metadata: Record<string, unknown>, nodeType = 'webclient') {
            const { container } = renderNode(makeNodeProps(undefined, { 'node-type': nodeType, metadata }));
            return container.querySelector('[data-testid="custom-node"] > div') as HTMLElement;
        }

        it('applies the background and text colours', () => {
            const nodeDiv = renderStyled({ 'standard-node-style': { background: BLOCK_BLUE, text: '#ffffff' } });

            expect(nodeDiv.style.background).toBe(normalisedColor(BLOCK_BLUE));
            expect(nodeDiv.style.color).toBe(normalisedColor('#ffffff'));
        });

        it('uses the block background as the border when the node has no risk level', () => {
            const nodeDiv = renderStyled({ 'standard-node-style': { background: BLOCK_BLUE } });

            expect(nodeDiv.style.borderColor).toBe(normalisedColor(BLOCK_BLUE));
        });

        it('keeps the AIGF risk colour as the border when a block style is also set', () => {
            const nodeDiv = renderStyled({
                'standard-node-style': { background: BLOCK_BLUE },
                aigf: { 'risk-level': 'high' },
            });

            expect(nodeDiv.style.borderColor).toBe(normalisedColor(getRiskLevelColor('high')));
            expect(nodeDiv.style.background).toBe(normalisedColor(BLOCK_BLUE));
        });

        it('falls back to the card background for a node type with no catalogued colour', () => {
            const nodeDiv = renderStyled({}, 'not-a-known-type');

            expect(nodeDiv.style.background).toBe(normalisedColor(THEME.colors.card));
        });

        it.each([
            ['an empty string', ''],
            ['whitespace', '   '],
            ['a non-string value', { not: 'a colour' }],
            ['a url()', 'url(https://host/pixel.png)'],
        ])('ignores %s as the background, keeping the default background and border', (_label, background) => {
            const styled = renderStyled({ 'standard-node-style': { background } });
            const unstyled = renderStyled({});

            expect(styled.style.background).toBe(unstyled.style.background);
            expect(styled.style.borderColor).not.toBe('');
            expect(styled.style.borderColor).toBe(unstyled.style.borderColor);
        });

        it('ignores a non-string text colour', () => {
            const styled = renderStyled({ 'standard-node-style': { text: 42 } });
            const unstyled = renderStyled({});

            expect(styled.style.color).toBe(unstyled.style.color);
        });
    });
});

describe('presentation mode', () => {
    const controls = {
        'client-ledger-human-approval': { description: 'A human approves changes', requirements: [] },
        'encryption-at-rest': { description: 'Data is encrypted at rest', requirements: [] },
    };
    const textSize = () => screen.getByText('Test Node').parentElement!.parentElement!.parentElement!.style.fontSize;
    const controlBadge = () => screen.getByText('2').parentElement!;
    const renderNode = (presenting: boolean) => {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(presenting);
        render(<CustomNode {...makeNodeProps(undefined, { controls })} presentationStore={store} />);
    };

    it('keeps the normal size when presentation mode is off', () => {
        renderNode(false);
        expect(screen.getByTestId('custom-node').style.width).toBe('220px');
        expect(textSize()).toBe('14px');
        expect(controlBadge().style.fontSize).toBe('12px');
    });

    it('makes the node wider and its text and control count larger', () => {
        renderNode(true);
        expect(screen.getByTestId('custom-node').style.width).toBe('320px');
        expect(textSize()).toBe('24px');
        expect(controlBadge().style.fontSize).toBe('18px');
    });
});

const toRgb = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

const evaluation = (status: 'met' | 'not-met', extra: Partial<ControlEvaluationDecorator['data']> = {}): ElementEvaluation => ({
    status,
    latest: [{
        schema: 's', uniqueId: 'eval-1', type: 'control-evaluation', target: ['t'], appliesTo: ['node-1'],
        data: { control: { 'unique-id': 'client-ledger-human-approval', 'control-id': 'SDLC-PREV-001', 'requirement-url': 'https://example.org/r' }, status, 'evaluated-at': '2026-11-04T15:00:00Z', ...extra },
    }],
});

function renderWithEvaluation(map: Map<string, ElementEvaluation>) {
    return render(
        <ControlEvaluationContext.Provider value={map}>
            <CustomNode {...makeNodeProps(undefined, { 'unique-id': 'node-1' })} />
        </ControlEvaluationContext.Provider>
    );
}

describe('control evaluations', () => {
    const nodeBorder = (container: HTMLElement) => (container.querySelector('[data-testid="custom-node"] > div') as HTMLElement).style.border;

    it('shows no badge without an evaluation', () => {
        renderWithEvaluation(new Map());
        expect(screen.queryByTestId('control-evaluation-badge')).toBeNull();
    });

    it('keeps its normal border without an evaluation', () => {
        const { container } = renderWithEvaluation(new Map());
        expect(nodeBorder(container)).toBe(`2px solid ${toRgb(getNodeTypeColor('service'))}`);
    });

    it('shows no badge when the evaluations name other elements only', () => {
        const { container } = renderWithEvaluation(new Map([['other-node', evaluation('not-met')]]));
        expect(screen.queryByTestId('control-evaluation-badge')).toBeNull();
        expect(nodeBorder(container)).toBe(`2px solid ${toRgb(getNodeTypeColor('service'))}`);
    });

    it('shows Not met in the error text colour, with a red border', () => {
        const { container } = renderWithEvaluation(new Map([['node-1', evaluation('not-met')]]));
        const badge = screen.getByTestId('control-evaluation-badge');
        expect(badge.textContent).toContain('Not met');
        expect(badge.style.color).toBe(THEME.colors.errorText);
        expect(nodeBorder(container)).toBe(`3px solid ${toRgb(THEME.colors.error)}`);
    });

    it('shows Met in the success text colour', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('met')]]));
        const badge = screen.getByTestId('control-evaluation-badge');
        expect(badge.textContent).toContain('Met');
        expect(badge.style.color).toBe(THEME.colors.successText);
    });

    it('labels the badge for assistive technology, hides its icon, and has no native tooltip', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('not-met')]]));
        const badge = screen.getByTestId('control-evaluation-badge');
        expect(badge.getAttribute('aria-label')).toBe('Control evaluation: Not met');
        expect(badge.hasAttribute('title')).toBe(false);
        expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('frames the first finding as what the control requires, with its cause, on hover', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('not-met', { findings: [{ subject: 'node-1', description: 'A human approved this change', cause: 'absent' }] })]]));
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
        expect(screen.getByTestId('evaluation-finding').textContent).toBe('Requires: A human approved this change (absent)');
    });

    it('names the finding\'s subject when it is another element', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('not-met', { findings: [{ subject: 'trade-api-to-client-ledger', description: 'A human approved this change' }] })]]));
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
        expect(screen.getByTestId('evaluation-finding').textContent).toBe('trade-api-to-client-ledger — Requires: A human approved this change');
    });

    it('shows the control id, then the control unique-id muted, with the status glyph hidden from assistive technology', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('not-met')]]));
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
        expect(screen.getByText('SDLC-PREV-001')).toBeTruthy();
        const uniqueId = screen.getByText('client-ledger-human-approval');
        expect(uniqueId.style.color).toBe(THEME.colors.muted);
        expect(uniqueId.style.fontWeight).not.toBe('600');
        expect(screen.getByText('✗').getAttribute('aria-hidden')).toBe('true');
    });

    it('enlarges the badge in presentation mode', () => {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(true);
        render(
            <ControlEvaluationContext.Provider value={new Map([['node-1', evaluation('met')]])}>
                <CustomNode {...makeNodeProps(undefined, { 'unique-id': 'node-1' })} presentationStore={store} />
            </ControlEvaluationContext.Provider>
        );
        expect(screen.getByTestId('control-evaluation-badge').style.fontSize).toBe('18px');
    });

    it('shows Met and the approver on hover', () => {
        renderWithEvaluation(new Map([['node-1', evaluation('met', { actors: { approver: 'alice' } })]]));
        expect(screen.getByTestId('control-evaluation-badge').textContent).toContain('Met');
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
        expect(screen.getByText(/approved by alice/)).toBeTruthy();
    });
});

describe('decision overlay', () => {
    const reportCalloutSize = vi.fn();

    beforeEach(() => {
        reportCalloutSize.mockClear();
        storeNodes.clear();
        storeNodes.set('node-1', { id: 'node-1', width: 220, height: 80, positionAbsolute: { x: 10, y: 20 } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderOverlay(showDecisions: boolean, map: Map<string, ElementEvaluation> = new Map(), presenting = false) {
        const store = createPresentationModeStore(createMemoryStorage());
        store.set(presenting);
        return render(
            <DecisionOverlayContext.Provider
                value={{
                    showDecisions,
                    subjectLabels: new Map([['trade-api-to-client-ledger', 'Trade API → Client Ledger']]),
                    calloutSizes: new Map(),
                    reportCalloutSize,
                }}
            >
                <ControlEvaluationContext.Provider value={map}>
                    <CustomNode {...makeNodeProps(undefined, { 'unique-id': 'node-1' })} presentationStore={store} />
                </ControlEvaluationContext.Provider>
            </DecisionOverlayContext.Provider>
        );
    }

    const notMet = () => new Map([['node-1', evaluation('not-met', {
        findings: [{ subject: 'trade-api-to-client-ledger', description: 'A human approved this change', cause: 'absent' }],
    })]]);

    it('shows no callout while the overlay is off', () => {
        renderOverlay(false, notMet(), true);
        expect(screen.queryByTestId('decision-callout')).toBeNull();
    });

    it('shows no callout for a node without an evaluation', () => {
        renderOverlay(true);
        expect(screen.queryByTestId('decision-callout')).toBeNull();
    });

    it('shows a blocked callout naming the control, what it requires and the relationship it is about', () => {
        renderOverlay(true, notMet());
        const callout = screen.getByTestId('decision-callout');
        expect(callout.dataset.outcome).toBe('blocked');
        expect(callout.textContent).toBe('✗ Blockedclient-ledger-human-approvalRequires: A human approved this changeon Trade API → Client Ledger');
        expect(callout.style.pointerEvents).toBe('none');
    });

    it('shows who approved a met decision, with the control and short commit', () => {
        renderOverlay(true, new Map([['node-1', evaluation('met', {
            actors: { reviewer: 'review-bot', approver: 'alice' },
            change: { commit: '07009cb5f2c80af21ea569baf2049b216eee2692' },
        })]]));
        const callout = screen.getByTestId('decision-callout');
        expect(callout.dataset.outcome).toBe('approved');
        expect(callout.textContent).toBe('✓ Approved by aliceclient-ledger-human-approvalcommit 07009cb');
    });

    it('shows a met decision with its reviewer', () => {
        renderOverlay(true, new Map([['node-1', evaluation('met', { actors: { reviewer: 'review-bot' } })]]));
        expect(screen.getByTestId('decision-callout').textContent).toBe('✓ Met · reviewed by review-bot');
    });

    it('keeps the callout while the hover card is open, so the labels it moved stay where they are', () => {
        renderOverlay(true, notMet());
        fireEvent.mouseEnter(screen.getByTestId('custom-node'));
        expect(screen.getByTestId('decision-callout')).toBeTruthy();
    });

    it('hangs the callout below the node in the edge-label layer, above the other nodes', () => {
        renderOverlay(true, notMet());
        const callout = screen.getByTestId('decision-callout');
        expect(callout.parentElement).toBe(screen.getByTestId('label-renderer'));
        expect(callout.style.transform).toBe('translate(10px, 106px)');
        expect(callout.style.width).toBe('220px');
        expect(callout.style.zIndex).toBe('500');
    });

    it('is dimmed with its node', () => {
        storeNodes.set('node-1', { id: 'node-1', width: 220, height: 80, positionAbsolute: { x: 10, y: 20 }, style: { opacity: 0.15 } });
        renderOverlay(true, notMet());
        expect(screen.getByTestId('decision-callout').style.opacity).toBe('0.15');
    });

    it('waits for the node to be measured', () => {
        storeNodes.set('node-1', { id: 'node-1', positionAbsolute: { x: 10, y: 20 } });
        renderOverlay(true, notMet());
        expect(screen.queryByTestId('decision-callout')).toBeNull();
    });

    it('reports how far the callout reaches below the node, and withdraws it when the callout goes', () => {
        mockOffsetSize(220, 90);
        const { unmount } = renderOverlay(true, notMet(), true);
        expect(reportCalloutSize).toHaveBeenLastCalledWith('node-1', { width: 220, height: 100 });
        unmount();
        expect(reportCalloutSize).toHaveBeenLastCalledWith('node-1', undefined);
    });

    it('sizes the callout text with presentation mode', () => {
        const { unmount } = renderOverlay(true, notMet());
        expect(screen.getByTestId('decision-callout').style.fontSize).toBe('12px');
        unmount();
        renderOverlay(true, notMet(), true);
        expect(screen.getByTestId('decision-callout').style.fontSize).toBe('16px');
    });
});
