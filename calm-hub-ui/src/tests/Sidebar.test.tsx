import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Edge, Node } from '../visualizer/components/cytoscape-renderer/CytoscapeRenderer.js';
import { Sidebar } from '../visualizer/components/sidebar/Sidebar.js';

describe('Sidebar Component', () => {
    // mock all required functions
    const mockCloseSidebar = vi.fn();
    const mockUpdateElement = vi.fn();
    const mockDeleteElement = vi.fn();
    const mockCreateEdge = vi.fn();
    
    // mock data
    const mockNodeData = {
        id: 'node-1',
        label: 'Node 1',
        type: 'type-1',
        description: 'Mock Node',
    };
    
    const mockEdgeData = {
        id: 'edge-1',
        label: 'Edge 1',
        source: 'node-1',
        target: 'node-2',
    };
    
    const mockNodes = [
        { data: mockNodeData },
        { data: { id: 'node-2', label: 'Node 2', type: 'type-2', description: 'Another node' } }
    ];
    
    const renderSidebar = (selectedData) => {
        return render(
            <Sidebar 
                selectedData={selectedData} 
                closeSidebar={mockCloseSidebar}
                updateElement={mockUpdateElement}
                deleteElement={mockDeleteElement}
                nodes={mockNodes}
                createEdge={mockCreateEdge}
            />
        );
    };
    
    beforeEach(() => {
        // reset mocks before each test
        vi.clearAllMocks();
    });
    
    it('should render node details correctly', () => {
        renderSidebar(mockNodeData);
        
        expect(screen.getByText('Node Details')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.getByText('type-1')).toBeInTheDocument();
        expect(screen.getByText('Mock Node')).toBeInTheDocument();
    });
    
    it('should render edge details correctly', () => {
        renderSidebar(mockEdgeData);
        
        expect(screen.getByText('Edge Details')).toBeInTheDocument();
        expect(screen.getByText('edge-1')).toBeInTheDocument();
        expect(screen.getByText('Edge 1')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
    });
    
    it('should call closeSidebar when close button is clicked', () => {
        renderSidebar(mockNodeData);
        
        fireEvent.click(screen.getByLabelText('close-sidebar'));
        expect(mockCloseSidebar).toHaveBeenCalledTimes(1);
    });
    
    it('should enter edit mode when edit button is clicked', () => {
        renderSidebar(mockNodeData);
        
        fireEvent.click(screen.getByLabelText('Edit element'));
        expect(screen.getByLabelText('Create or Save changes')).toBeInTheDocument();
    });
    
    it('should call updateElement when saving changes', () => {
        renderSidebar(mockNodeData);
        
        // enter edit mode
        fireEvent.click(screen.getByLabelText('Edit element'));
        
        const labelInput = screen.getByLabelText('Name');
        fireEvent.change(labelInput, { target: { value: 'Updated Node Name' } });
        
        // Save changes
        fireEvent.click(screen.getByLabelText('Create or Save changes'));
        
        // Verify updateElement was called with updated data
        expect(mockUpdateElement).toHaveBeenCalledTimes(1);
        expect(mockUpdateElement).toHaveBeenCalledWith(expect.objectContaining({
            id: 'node-1',
            label: 'Updated Node Name'
        }));
    });
    
    it('should call deleteElement when delete button is clicked', () => {
        // Use a node with an ID that looks newly created
        const newNodeData = { ...mockNodeData, id: 'node-1234567890' };
        renderSidebar(newNodeData);
        
        fireEvent.click(screen.getByLabelText('Delete element'));
        expect(mockDeleteElement).toHaveBeenCalledTimes(1);
        expect(mockDeleteElement).toHaveBeenCalledWith(newNodeData.id);
    });
});