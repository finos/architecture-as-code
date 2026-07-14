import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomNode } from './CustomNode.js';
import { DiagramActionsContext } from '../../context/DiagramActionsContext.js';

vi.mock('reactflow', () => ({
    Handle: () => null,
    Position: { Right: 'right', Left: 'left' },
}));

function makeNodeProps(details?: Record<string, unknown>) {
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
    const originalLocation = window.location;

    beforeEach(() => {
        openSpy = vi.fn();
        window.open = openSpy as unknown as typeof window.open;
    });

    afterEach(() => {
        window.open = originalOpen;
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    });

    function setHostname(hostname: string) {
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, hostname },
            writable: true,
        });
    }

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
});
