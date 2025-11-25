import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MetadataPanel } from './MetadataPanel';

// Mock child components
vi.mock('./FlowsPanel', () => ({
    FlowsPanel: ({ flows }: { flows: unknown[] }) => (
        <div data-testid="flows-panel">Flows: {flows.length}</div>
    ),
}));

vi.mock('./ControlsPanel', () => ({
    ControlsPanel: ({ controls }: { controls: Record<string, unknown> }) => (
        <div data-testid="controls-panel">Controls: {Object.keys(controls).length}</div>
    ),
}));

describe('MetadataPanel', () => {
    const mockFlows = [
        {
            'unique-id': 'flow-1',
            name: 'Test Flow',
            description: 'A test flow',
            transitions: [
                {
                    'sequence-number': 1,
                    description: 'Step 1',
                    'relationship-unique-id': 'rel-1',
                },
            ],
        },
    ];

    const mockControls = {
        'control-1': {
            description: 'Test control',
            requirements: [],
        },
    };

    const defaultProps = {
        flows: mockFlows,
        controls: mockControls,
        isCollapsed: false,
        onToggleCollapse: vi.fn(),
        height: 250,
        onHeightChange: vi.fn(),
    };

    it('renders nothing when no flows and no controls', () => {
        const { container } = render(
            <MetadataPanel
                {...defaultProps}
                flows={[]}
                controls={{}}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders collapsed view with counts when collapsed', () => {
        render(<MetadataPanel {...defaultProps} isCollapsed={true} />);

        expect(screen.getByText('Flows (1)')).toBeInTheDocument();
        expect(screen.getByText('Controls (1)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Expand metadata panel' })).toBeInTheDocument();
    });

    it('renders expanded view with Metadata header when not collapsed', () => {
        render(<MetadataPanel {...defaultProps} />);

        expect(screen.getByText('Metadata')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Collapse metadata panel' })).toBeInTheDocument();
    });

    it('renders tab buttons when expanded', () => {
        render(<MetadataPanel {...defaultProps} />);

        expect(screen.getByRole('button', { name: /Flows \(1\)/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Controls \(1\)/ })).toBeInTheDocument();
    });

    it('shows FlowsPanel by default when flows exist', () => {
        render(<MetadataPanel {...defaultProps} />);

        expect(screen.getByTestId('flows-panel')).toBeInTheDocument();
    });

    it('switches to ControlsPanel when clicking Controls tab', () => {
        render(<MetadataPanel {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /Controls \(1\)/ }));

        expect(screen.getByTestId('controls-panel')).toBeInTheDocument();
    });

    it('calls onToggleCollapse when clicking expand button in collapsed view', () => {
        const onToggleCollapse = vi.fn();
        render(<MetadataPanel {...defaultProps} isCollapsed={true} onToggleCollapse={onToggleCollapse} />);

        fireEvent.click(screen.getByRole('button', { name: 'Expand metadata panel' }));

        expect(onToggleCollapse).toHaveBeenCalled();
    });

    it('calls onToggleCollapse when clicking collapse button in expanded view', () => {
        const onToggleCollapse = vi.fn();
        render(<MetadataPanel {...defaultProps} onToggleCollapse={onToggleCollapse} />);

        fireEvent.click(screen.getByRole('button', { name: 'Collapse metadata panel' }));

        expect(onToggleCollapse).toHaveBeenCalled();
    });

    it('shows only flows tab when no controls exist', () => {
        render(<MetadataPanel {...defaultProps} controls={{}} />);

        expect(screen.getByRole('button', { name: /Flows \(1\)/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Controls/ })).not.toBeInTheDocument();
    });

    it('shows only controls tab when no flows exist', () => {
        render(<MetadataPanel {...defaultProps} flows={[]} />);

        expect(screen.getByRole('button', { name: /Controls \(1\)/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Flows/ })).not.toBeInTheDocument();
    });

    it('defaults to controls tab when no flows exist', () => {
        render(<MetadataPanel {...defaultProps} flows={[]} />);

        expect(screen.getByTestId('controls-panel')).toBeInTheDocument();
    });

    it('renders resize handle with drag indicator', () => {
        render(<MetadataPanel {...defaultProps} />);

        expect(screen.getByTitle('Drag to resize')).toBeInTheDocument();
    });
});
