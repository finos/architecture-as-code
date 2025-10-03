import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiagramControlPanel } from './DiagramControlPanel.js';
import { SidebarProps } from '../../sidebar/Sidebar.js';
import { CytoscapeRendererProps } from '../cytoscape-renderer/CytoscapeRenderer.js';

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

describe('DiagramControlPanel', () => {
    it('should successfully render cytoscape control panel', () => {
        render(
            <DiagramControlPanel
                title="Test Architecture"
                isNodeDescActive={true}
                isRelationshipDescActive={true}
                toggleConnectionDesc={vi.fn()}
                toggleNodeDesc={vi.fn()}
            />
        );
        expect(screen.getByText('Architecture:')).toBeInTheDocument();
        expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('should call toggleNodeDesc when Node Descriptions checkbox is clicked', () => {
        const toggleNodeDesc = vi.fn();
        render(
            <DiagramControlPanel
                title="Test Architecture"
                isNodeDescActive={false}
                isRelationshipDescActive={false}
                toggleNodeDesc={toggleNodeDesc}
                toggleConnectionDesc={vi.fn()}
            />
        );
        fireEvent.click(screen.getByLabelText('node-description'));
        expect(toggleNodeDesc).toHaveBeenCalled();
    });

    it('should call toggleConnectionDesc when Relationship Descriptions checkbox is clicked', () => {
        const toggleConnectionDesc = vi.fn();
        render(
            <DiagramControlPanel
                title="Test Architecture"
                isNodeDescActive={false}
                isRelationshipDescActive={false}
                toggleNodeDesc={vi.fn()}
                toggleConnectionDesc={toggleConnectionDesc}
            />
        );
        fireEvent.click(screen.getByLabelText('connection-description'));
        expect(toggleConnectionDesc).toHaveBeenCalled();
    });
});
