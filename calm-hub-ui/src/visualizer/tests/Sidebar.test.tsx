import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Edge, Node } from '../components/cytoscape-renderer/CytoscapeRenderer.js';
import Sidebar from '../components/sidebar/Sidebar.js';

describe('Sidebar Component', () => {
    const mockCloseSidebar = vi.fn();

    const mockNodeData: Node['data'] = {
        id: 'node-1',
        label: 'Node 1',
        type: 'type-1',
        description: 'Mock Node',
    };

    const mockEdgeData: Edge['data'] = {
        id: 'edge-1',
        label: 'Edge 1',
        source: 'node-1',
        target: 'node-2',
    };

    it('should render node details correctly', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Node Details')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.getByText('type-1')).toBeInTheDocument();
        expect(screen.getByText('Mock Node')).toBeInTheDocument();
    });

    it('should render edge details correctly', () => {
        render(<Sidebar selectedData={mockEdgeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Edge Details')).toBeInTheDocument();
        expect(screen.getByText('edge-1')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
    });

    it('should call closeSidebar when close button is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('button', { name: 'close-sidebar' }));
        expect(mockCloseSidebar).toHaveBeenCalled();
    });
});
