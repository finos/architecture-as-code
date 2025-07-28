import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VisualizerContainer } from './VisualizerContainer.js';
import { CytoscapeNode, Edge } from '../../contracts/contracts.js';
import { SidebarProps } from '../sidebar/Sidebar.js';
import { CytoscapeRendererProps } from '../cytoscape/cytoscape-renderer/CytoscapeRenderer.js';

vi.mock('../sidebar/Sidebar.js', () => ({
    Sidebar: ({ closeSidebar }: SidebarProps) => (
        <div data-testid="sidebar">
            <button onClick={closeSidebar}>Close</button>
        </div>
    ),
}));

vi.mock('../cytoscape/cytoscape-renderer/CytoscapeRenderer.js', () => ({
    CytoscapeRenderer: ({
        nodeClickedCallback,
        edgeClickedCallback,
        nodes,
        edges,
    }: CytoscapeRendererProps) => (
        <div>
            <button data-testid="node" onClick={() => nodeClickedCallback(nodes[0]['data'])}>
                Node
            </button>
            <button data-testid="edge" onClick={() => edgeClickedCallback(edges[0]['data'])}>
                Edge
            </button>
        </div>
    ),
}));

describe('VisualizerContainer', () => {
    it('renders without crashing', () => {
        render(
            <VisualizerContainer title="Test Architecture" calmKey="test" nodes={[]} edges={[]} />
        );

        expect(screen.getByTestId('visualizer-container')).toBeInTheDocument();
    });

    it('shows Sidebar when a node is clicked and closes it', () => {
        const nodes: CytoscapeNode[] = [
            {
                data: {
                    description: '',
                    type: '',
                    name: 'node1',
                    id: 'node1',
                    parent: undefined,
                    interfaces: undefined,
                    controls: undefined,
                    cytoscapeProps: {
                        labelWithDescription: '',
                        labelWithoutDescription: '',
                    },
                },
            },
        ];

        render(
            <VisualizerContainer
                title="Test Architecture"
                calmKey="test"
                nodes={nodes}
                edges={[]}
            />
        );

        fireEvent.click(screen.getByTestId('node'));
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Close'));
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });

    it('shows Sidebar when an edge is clicked and closes it', () => {
        const edges: Edge[] = [
            {
                data: {
                    id: 'a',
                    label: 'a',
                    source: 'a',
                    target: 'b',
                },
            },
        ];

        render(
            <VisualizerContainer
                title="Test Architecture"
                calmKey="test"
                nodes={[]}
                edges={edges}
            />
        );

        fireEvent.click(screen.getByTestId('edge'));
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Close'));
        expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    });
});
