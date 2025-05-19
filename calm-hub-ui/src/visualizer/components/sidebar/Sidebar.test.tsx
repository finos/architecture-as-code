import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from './Sidebar.js';
import { CalmNode, Edge } from '../../contracts/contracts.js';

describe('Sidebar Component', () => {
    const mockCloseSidebar = vi.fn();

    const mockNodeData: CalmNode['data'] = {
        id: 'node-1',
        label: 'Node 1',
        type: 'type-1',
        description: 'Mock Node',
        _displayPlaceholderWithDesc: '',
        _displayPlaceholderWithoutDesc: '',
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
    } as CalmNode['data'];

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

    it('should display message unknown entity', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(<Sidebar selectedData={{} as any} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Unknown Selected Entity')).toBeInTheDocument();
        expect(screen.queryByText('Node Details')).not.toBeInTheDocument();
        expect(screen.queryByText('Edge Details')).not.toBeInTheDocument();
    });

    it('should display controls and interfaces if available', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        expect(
            screen.getByText(
                'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-specification.json'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('Control requirements for delivering patterns')
        ).toBeInTheDocument();
        expect(screen.getByText('load-balancer-host-port')).toBeInTheDocument();
    });

    it('should call closeSidebar when close button is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('button', { name: 'close-sidebar' }));
        expect(mockCloseSidebar).toHaveBeenCalled();
    });
});
