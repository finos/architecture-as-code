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

vi.mock('./DeploymentPanel', () => ({
    DeploymentPanel: ({ decorators }: { decorators: unknown[] }) => (
        <div data-testid="deployment-panel">Deployments: {decorators.length}</div>
    ),
}));

vi.mock('./AdrsPanel', () => ({
    AdrsPanel: ({ adrs }: { adrs: string[] }) => (
        <div data-testid="adrs-panel">ADRs: {adrs.length}</div>
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

    const mockDecorators = [
        {
            schema: 'https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.standard.json',
            uniqueId: 'dec-1',
            type: 'deployment',
            target: ['/calm/namespaces/ns/architectures/arch/versions/1-0-0'],
            appliesTo: ['node-a'],
            data: {
                status: 'completed',
                'start-time': '2024-01-15T10:00:00Z',
                'end-time': '2024-01-15T10:05:00Z',
            },
        },
    ];

    const defaultProps = {
        flows: mockFlows,
        controls: mockControls,
        decorators: [] as typeof mockDecorators,
        adrs: [] as string[],
        isCollapsed: false,
        onToggleCollapse: vi.fn(),
        height: 250,
        onHeightChange: vi.fn(),
    };

    it('renders nothing when no flows, no controls, and no decorators', () => {
        const { container } = render(
            <MetadataPanel
                {...defaultProps}
                flows={[]}
                controls={{}}
                decorators={[]}
                adrs={[]}
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

    it('renders deployment count in collapsed view when decorators exist', () => {
        render(<MetadataPanel {...defaultProps} decorators={mockDecorators} isCollapsed={true} />);

        expect(screen.getByText('Deployment (1)')).toBeInTheDocument();
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

    it('shows Deployment tab button when decorators exist', () => {
        render(<MetadataPanel {...defaultProps} decorators={mockDecorators} />);

        expect(screen.getByRole('button', { name: 'Deployment' })).toBeInTheDocument();
    });

    it('does not show Deployment tab when decorators is empty', () => {
        render(<MetadataPanel {...defaultProps} decorators={[]} />);

        expect(screen.queryByRole('button', { name: /Deployment/ })).not.toBeInTheDocument();
    });

    it('switches to DeploymentPanel when clicking Deployment tab', () => {
        render(<MetadataPanel {...defaultProps} decorators={mockDecorators} />);

        fireEvent.click(screen.getByRole('button', { name: 'Deployment' }));

        expect(screen.getByTestId('deployment-panel')).toBeInTheDocument();
    });

    it('defaults to deployment tab when only decorators exist', () => {
        render(<MetadataPanel {...defaultProps} flows={[]} controls={{}} decorators={mockDecorators} />);

        expect(screen.getByTestId('deployment-panel')).toBeInTheDocument();
    });

    it('shows ADRs tab button when adrs exist', () => {
        render(<MetadataPanel {...defaultProps} adrs={['https://example.com/adr/0001.md', 'https://example.com/adr/0002.md']} />);

        expect(screen.getByRole('button', { name: /ADRs \(2\)/ })).toBeInTheDocument();
    });

    it('does not show ADRs tab when adrs is empty', () => {
        render(<MetadataPanel {...defaultProps} adrs={[]} />);

        expect(screen.queryByRole('button', { name: /ADRs/ })).not.toBeInTheDocument();
    });

    it('switches to AdrsPanel when clicking ADRs tab', () => {
        render(<MetadataPanel {...defaultProps} adrs={['https://example.com/adr/0001.md']} />);

        fireEvent.click(screen.getByRole('button', { name: /ADRs \(1\)/ }));

        expect(screen.getByTestId('adrs-panel')).toBeInTheDocument();
    });

    it('defaults to adrs tab when only adrs exist', () => {
        render(<MetadataPanel {...defaultProps} flows={[]} controls={{}} decorators={[]} adrs={['https://example.com/adr/0001.md']} />);

        expect(screen.getByTestId('adrs-panel')).toBeInTheDocument();
    });

    it('renders ADR count in collapsed view when adrs exist', () => {
        render(<MetadataPanel {...defaultProps} adrs={['https://example.com/adr/0001.md']} isCollapsed={true} />);

        expect(screen.getByText('ADRs (1)')).toBeInTheDocument();
    });

    it('renders only with adrs and no other metadata', () => {
        const { container } = render(
            <MetadataPanel
                {...defaultProps}
                flows={[]}
                controls={{}}
                decorators={[]}
                adrs={['https://example.com/adr/0001.md']}
            />
        );
        expect(container.firstChild).not.toBeNull();
    });
});
