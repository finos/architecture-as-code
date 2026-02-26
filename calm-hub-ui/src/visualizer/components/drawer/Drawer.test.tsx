import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Drawer } from './Drawer.js';
import { Data } from '../../../model/calm.js';
import { ReactFlowVisualizerProps } from '../reactflow/ReactFlowVisualizer.js';
import { SidebarProps } from '../sidebar/Sidebar.js';
import { DropzoneOptions } from 'react-dropzone';

// Mock dependencies
vi.mock('../sidebar/Sidebar.js', () => ({
    Sidebar: ({ selectedData, closeSidebar }: SidebarProps) => (
        <div data-testid="sidebar">
            <button onClick={closeSidebar}>Close</button>
            <div>{selectedData?.name}</div>
        </div>
    ),
}));
vi.mock('../reactflow/ReactFlowVisualizer.js', () => ({
    ReactFlowVisualizer: ({ calmData }: ReactFlowVisualizerProps) => (
        <div data-testid="reactflow-visualizer">
            <div data-testid="node-count">{calmData?.nodes?.length ?? 0}</div>
            <div data-testid="relationship-count">{calmData?.relationships?.length ?? 0}</div>
        </div>
    ),
}));
vi.mock('react-dropzone', async () => {
    const actual = await vi.importActual('react-dropzone');
    return {
        ...actual,
        useDropzone: ({ onDrop }: DropzoneOptions) => ({
            getRootProps: () => ({}),
            getInputProps: () => ({}),
            isDragActive: false,
            onDrop,
        }),
    };
});

const calmData = {
    name: 'Test CALM',
    calmType: 'arch',
    id: '123',
    version: '1.0',
    data: {
        nodes: [
            {
                'unique-id': 'n1',
                name: 'Node 1',
                description: 'desc1',
                'node-type': 'typeA',
            },
            {
                'unique-id': 'n2',
                name: 'Node 2',
                description: 'desc2',
                'node-type': 'typeB',
            },
        ],
        relationships: [
            {
                'unique-id': 'r1',
                description: 'rel1',
                'relationship-type': {
                    interacts: {
                        actor: 'n1',
                        nodes: ['n2'],
                    },
                },
            },
            {
                'unique-id': 'r2',
                description: 'rel2',
                'relationship-type': {
                    'composed-of': {
                        container: 'n1',
                        nodes: ['n2'],
                    },
                },
            },
        ],
    },
};

describe('Drawer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders dropzone placeholder when no data is provided', () => {
        render(<Drawer />);
        expect(screen.getByText(/Drag and drop your file here or/i)).toBeInTheDocument();
        expect(screen.getByText(/Browse/i)).toBeInTheDocument();
    });

    it('renders ReactFlowVisualizer when data is provided', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        expect(screen.getByTestId('reactflow-visualizer')).toBeInTheDocument();
        expect(screen.getByTestId('node-count')).toHaveTextContent('2');
        expect(screen.getByTestId('relationship-count')).toHaveTextContent('2');
    });

    it('shows sidebar when selectedNode is set', () => {
        render(<Drawer data={calmData as unknown as Data} />);
        const checkbox = screen.getByRole('checkbox', { name: /drawer-toggle/i });
        act(() => {
            fireEvent.click(checkbox);
        });
        expect(checkbox).toBeInTheDocument();
    });
});
