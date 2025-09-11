import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './Sidebar.js';
import { CytoscapeNodeData, Edge } from '../../contracts/contracts.js';

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: any) => <textarea value={value} readOnly data-testid="monaco-editor" />
}));

describe('Sidebar Component', () => {
    const mockCloseSidebar = vi.fn();

    const mockNodeData: CytoscapeNodeData = {
        id: 'node-1',
        name: 'Node 1',
        type: 'type-1',
        description: 'Mock Node',
        interfaces: [
            {
                'unique-id': 'load-balancer-host-port',
                host: '[[ HOST ]]',
                port: -1,
            },
        ],
        controls: {
            cbom: {
                description: 'Control requirements for delivering patterns',
                requirements: [
                    {
                        'control-requirement-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-specification.json',
                        'control-config-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-configuration.json',
                    },
                ],
            },
        },
    } as CytoscapeNodeData;

    const mockEdgeData: Edge['data'] = {
        id: 'edge-1',
        label: 'Edge 1',
        source: 'node-1',
        target: 'node-2',
    };

    it('should display message unknown entity', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(<Sidebar selectedData={{} as any} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Unknown Selected Entity')).toBeInTheDocument();
        expect(screen.queryByText('Node Details')).not.toBeInTheDocument();
        expect(screen.queryByText('Edge Details')).not.toBeInTheDocument();
    });

    it('should render edge details correctly', () => {
        render(<Sidebar selectedData={mockEdgeData} closeSidebar={mockCloseSidebar} />);

        // Monaco Editor is mocked as a textarea, so check its value
        const textarea = screen.getByTestId('monaco-editor');

        expect(screen.getByText('Edge Details')).toBeInTheDocument();
        expect(textarea).toHaveValue(JSON.stringify(mockEdgeData, null, 2));
    });

    it('should render node details dynamically based on selectedData', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Node Details')).toBeInTheDocument();

        // Monaco Editor is mocked as a textarea, so check its value
        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveValue(JSON.stringify(mockNodeData, null, 2));
    });

    it('should call closeSidebar when close button is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('button', { name: 'close-sidebar' }));
        expect(mockCloseSidebar).toHaveBeenCalled();
    });
});
