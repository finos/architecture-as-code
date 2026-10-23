import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './Sidebar.js';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => (
        <textarea value={value} readOnly data-testid="monaco-editor" />
    ),
}));

describe('Sidebar Component', () => {
    const mockCloseSidebar = vi.fn();

    const mockNodeData: CalmNodeSchema = {
        'unique-id': 'node-1',
        name: 'Node 1',
        'node-type': 'type-1',
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
                        'requirement-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-specification.json',
                        'config-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-configuration.json',
                    },
                ],
            },
        },
    };

    const mockEdgeData: CalmRelationshipSchema = {
        'unique-id': 'edge-1',
        'relationship-type': {
            connects: {
                source: { node: 'node-1' },
                destination: { node: 'node-2' },
            },
        },
        description: 'Edge 1',
    };

    it('should display message unknown entity', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(<Sidebar selectedData={{} as any} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Unknown Selected Entity')).toBeInTheDocument();
    });

    it('should render readable relationship details by default', () => {
        render(<Sidebar selectedData={mockEdgeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Relationship')).toBeInTheDocument();
        expect(screen.getByText('Edge 1')).toBeInTheDocument();
        expect(screen.getByText('edge-1')).toBeInTheDocument();
        expect(screen.getByText('connects')).toBeInTheDocument();
    });

    it('should render readable node details by default', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('Mock Node')).toBeInTheDocument();
    });

    it('should show JSON view when JSON tab is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveValue(JSON.stringify(mockNodeData, null, 2));
    });

    it('should switch back to details view', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
    });

    it('should call closeSidebar when close button is clicked', () => {
        render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);

        fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
        expect(mockCloseSidebar).toHaveBeenCalled();
    });

    describe('resizing', () => {
        beforeEach(() => sessionStorage.clear());

        const panelWidth = (container: HTMLElement) => (container.firstChild as HTMLElement).style.getPropertyValue('--details-width');

        it('widens the panel when its handle is dragged left, and keeps the width when it is opened again', () => {
            const { container, unmount } = render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);
            const handle = screen.getByRole('separator', { name: 'Resize details panel' });
            fireEvent.pointerDown(handle, { clientX: 900, pointerId: 1 });
            fireEvent.pointerMove(handle, { clientX: 800, pointerId: 1 });
            fireEvent.pointerUp(handle, { clientX: 800, pointerId: 1 });
            expect(panelWidth(container)).toBe('484px');
            unmount();

            const reopened = render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);
            expect(panelWidth(reopened.container)).toBe('484px');
        });

        it('does not shrink below its minimum, and moving the pointer without a drag does nothing', () => {
            const { container } = render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);
            const handle = screen.getByRole('separator', { name: 'Resize details panel' });
            fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
            expect(panelWidth(container)).toBe('384px');
            fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1 });
            fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
            expect(panelWidth(container)).toBe('320px');
        });

        it('resizes with the arrow keys', () => {
            const { container } = render(<Sidebar selectedData={mockNodeData} closeSidebar={mockCloseSidebar} />);
            const handle = screen.getByRole('separator', { name: 'Resize details panel' });
            fireEvent.keyDown(handle, { key: 'ArrowLeft' });
            expect(panelWidth(container)).toBe('416px');
        });
    });
});
