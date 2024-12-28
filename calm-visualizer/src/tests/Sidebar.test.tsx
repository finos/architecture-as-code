import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from '../components/sidebar/Sidebar';
import { Node, Edge } from '../components/cytoscape-renderer/CytoscapeRenderer';

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
        expect(screen.getByText('unique-id: node-1')).toBeInTheDocument();
        expect(screen.getByText('name: Node 1')).toBeInTheDocument();
        expect(screen.getByText('node-type: type-1')).toBeInTheDocument();
        expect(screen.getByText('description: Mock Node')).toBeInTheDocument();
    });

    it('should render edge details correctly', () => {
        render(<Sidebar selectedData={mockEdgeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Edge Details')).toBeInTheDocument();
        expect(screen.getByText('unique-id: edge-1')).toBeInTheDocument();
        expect(screen.getByText('description: Edge 1')).toBeInTheDocument();
        expect(screen.getByText('source: node-1')).toBeInTheDocument();
        expect(screen.getByText('target: node-2')).toBeInTheDocument();
    });

    it('should call closeSidebar when close button is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('button', { name: 'close-sidebar' }));
        expect(mockCloseSidebar).toHaveBeenCalled();
    });
});
