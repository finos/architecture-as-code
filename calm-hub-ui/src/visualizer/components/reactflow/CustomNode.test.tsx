import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomNode } from './CustomNode.js';
import { DiagramActionsContext } from '../../context/DiagramActionsContext.js';
import { restoreLocation, setHostname } from '../../../test-support/window-location.js';
import { THEME, getRiskLevelColor } from './theme.js';

vi.mock('reactflow', () => ({
    Handle: () => null,
    Position: { Right: 'right', Left: 'left' },
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

    describe('building-block-style metadata', () => {
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
            const nodeDiv = renderStyled({ 'building-block-style': { background: BLOCK_BLUE, text: '#ffffff' } });

            expect(nodeDiv.style.background).toBe(normalisedColor(BLOCK_BLUE));
            expect(nodeDiv.style.color).toBe(normalisedColor('#ffffff'));
        });

        it('uses the block background as the border when the node has no risk level', () => {
            const nodeDiv = renderStyled({ 'building-block-style': { background: BLOCK_BLUE } });

            expect(nodeDiv.style.borderColor).toBe(normalisedColor(BLOCK_BLUE));
        });

        it('keeps the AIGF risk colour as the border when a block style is also set', () => {
            const nodeDiv = renderStyled({
                'building-block-style': { background: BLOCK_BLUE },
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
        ])('ignores %s as the background, keeping the default background and border', (_label, background) => {
            const styled = renderStyled({ 'building-block-style': { background } });
            const unstyled = renderStyled({});

            expect(styled.style.background).toBe(unstyled.style.background);
            expect(styled.style.borderColor).not.toBe('');
            expect(styled.style.borderColor).toBe(unstyled.style.borderColor);
        });

        it('ignores a non-string text colour', () => {
            const styled = renderStyled({ 'building-block-style': { text: 42 } });
            const unstyled = renderStyled({});

            expect(styled.style.color).toBe(unstyled.style.color);
        });
    });
});
