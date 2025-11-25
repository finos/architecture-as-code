import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowVisualizer } from './ReactFlowVisualizer';
import { CalmArchitectureSchema } from '../../../../../calm-models/src/types/core-types.js';

// Mock ArchitectureGraph since it has complex ReactFlow dependencies
vi.mock('./ArchitectureGraph', () => ({
    ArchitectureGraph: ({ jsonData, onNodeClick, onEdgeClick }: {
        jsonData: CalmArchitectureSchema;
        onNodeClick?: (node: unknown) => void;
        onEdgeClick?: (edge: unknown) => void;
    }) => (
        <div data-testid="architecture-graph">
            <div data-testid="node-count">{jsonData?.nodes?.length ?? 0}</div>
            <button
                data-testid="trigger-node-click"
                onClick={() => onNodeClick?.({ 'unique-id': 'test-node', name: 'Test Node', 'node-type': 'service' })}
            >
                Click Node
            </button>
            <button
                data-testid="trigger-edge-click"
                onClick={() => onEdgeClick?.({ 'unique-id': 'test-edge', description: 'Test Edge' })}
            >
                Click Edge
            </button>
        </div>
    ),
}));

const mockCalmData: CalmArchitectureSchema = {
    nodes: [
        {
            'unique-id': 'node-1',
            name: 'Service A',
            description: 'A service',
            'node-type': 'service',
        },
        {
            'unique-id': 'node-2',
            name: 'Database B',
            description: 'A database',
            'node-type': 'database',
        },
    ],
    relationships: [
        {
            'unique-id': 'rel-1',
            description: 'connects to',
            'relationship-type': {
                connects: {
                    source: { node: 'node-1' },
                    destination: { node: 'node-2' },
                },
            },
        },
    ],
};

describe('ReactFlowVisualizer', () => {
    const mockOnNodeClick = vi.fn();
    const mockOnEdgeClick = vi.fn();
    const mockOnBackgroundClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders with title', () => {
        render(
            <ReactFlowVisualizer
                title="Test Architecture"
                calmData={mockCalmData}
            />
        );
        expect(screen.getByText('Test Architecture')).toBeInTheDocument();
    });

    it('renders default title when none provided', () => {
        render(
            <ReactFlowVisualizer
                title=""
                calmData={mockCalmData}
            />
        );
        expect(screen.getByText('Architecture Diagram')).toBeInTheDocument();
    });

    it('renders control panel with checkboxes', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
            />
        );
        expect(screen.getByText('Node descriptions')).toBeInTheDocument();
        expect(screen.getByText('Connection descriptions')).toBeInTheDocument();
    });

    it('toggles node descriptions checkbox', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
            />
        );
        const nodeCheckbox = screen.getByRole('checkbox', { name: /node descriptions/i });
        expect(nodeCheckbox).toBeChecked();
        fireEvent.click(nodeCheckbox);
        expect(nodeCheckbox).not.toBeChecked();
    });

    it('toggles connection descriptions checkbox', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
            />
        );
        const connectionCheckbox = screen.getByRole('checkbox', { name: /connection descriptions/i });
        expect(connectionCheckbox).toBeChecked();
        fireEvent.click(connectionCheckbox);
        expect(connectionCheckbox).not.toBeChecked();
    });

    it('renders ArchitectureGraph with calmData', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
            />
        );
        expect(screen.getByTestId('architecture-graph')).toBeInTheDocument();
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
    });

    it('calls onNodeClick when node is clicked', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
                onNodeClick={mockOnNodeClick}
            />
        );
        fireEvent.click(screen.getByTestId('trigger-node-click'));
        expect(mockOnNodeClick).toHaveBeenCalledWith(
            expect.objectContaining({ 'unique-id': 'test-node' })
        );
    });

    it('calls onEdgeClick when edge is clicked', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
                onEdgeClick={mockOnEdgeClick}
            />
        );
        fireEvent.click(screen.getByTestId('trigger-edge-click'));
        expect(mockOnEdgeClick).toHaveBeenCalledWith(
            expect.objectContaining({ 'unique-id': 'test-edge' })
        );
    });

    it('has correct test id for component identification', () => {
        render(
            <ReactFlowVisualizer
                title="Test"
                calmData={mockCalmData}
            />
        );
        expect(screen.getByTestId('reactflow-visualizer')).toBeInTheDocument();
    });
});
