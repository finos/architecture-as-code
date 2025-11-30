import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ControlsPanel } from './ControlsPanel';

describe('ControlsPanel', () => {
    const mockControls = {
        'control-auth': {
            description: 'Authentication control for secure access',
            nodeName: 'API Gateway',
            appliesTo: 'node-api-gateway',
            requirements: [
                {
                    'requirement-url': 'https://example.com/requirements/auth',
                    'config-url': 'https://example.com/config/auth',
                },
            ],
        },
        'control-encryption': {
            description: 'Data encryption requirements',
            relationshipDescription: 'Database Connection',
            requirements: [
                {
                    config: {
                        appliesTo: {
                            nodes: ['node-1', 'node-2'],
                            relationships: ['rel-1'],
                        },
                        encryptionLevel: 'AES-256',
                    },
                },
            ],
            'aigf-mitigations': ['MIT-001', 'MIT-002'],
            'aigf-risks': ['RISK-001'],
        },
    };

    it('renders nothing when controls is undefined', () => {
        const { container } = render(
            <ControlsPanel controls={undefined as unknown as Record<string, unknown>} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing when controls is empty', () => {
        const { container } = render(<ControlsPanel controls={{}} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders CALM Controls header with count', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('CALM Controls')).toBeInTheDocument();
        expect(screen.getByText('2 controls')).toBeInTheDocument();
    });

    it('renders singular control count when only one control', () => {
        render(<ControlsPanel controls={{ 'control-1': mockControls['control-auth'] }} />);

        expect(screen.getByText('1 control')).toBeInTheDocument();
    });

    it('renders control IDs', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('control-auth')).toBeInTheDocument();
        expect(screen.getByText('control-encryption')).toBeInTheDocument();
    });

    it('renders control descriptions', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('Authentication control for secure access')).toBeInTheDocument();
        expect(screen.getByText('Data encryption requirements')).toBeInTheDocument();
    });

    it('renders node badge for controls with nodeName', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('Node: API Gateway')).toBeInTheDocument();
    });

    it('renders relationship badge for controls with relationshipDescription', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('Relationship: Database Connection')).toBeInTheDocument();
    });

    it('calls onControlClick when clicking a control', () => {
        const onControlClick = vi.fn();
        render(<ControlsPanel controls={mockControls} onControlClick={onControlClick} />);

        fireEvent.click(screen.getByText('control-auth'));

        expect(onControlClick).toHaveBeenCalledWith('control-auth');
    });

    it('calls onNodeClick when clicking node badge', () => {
        const onNodeClick = vi.fn();
        render(<ControlsPanel controls={mockControls} onNodeClick={onNodeClick} />);

        fireEvent.click(screen.getByText('Node: API Gateway'));

        expect(onNodeClick).toHaveBeenCalledWith('node-api-gateway');
    });

    it('renders Requirements section when present', () => {
        render(<ControlsPanel controls={mockControls} />);

        // Both controls have requirements, so there are 2 Requirements headings
        expect(screen.getAllByText('Requirements').length).toBeGreaterThan(0);
    });

    it('renders requirement URLs as links', () => {
        render(<ControlsPanel controls={mockControls} />);

        const requirementLink = screen.getByText('https://example.com/requirements/auth');
        expect(requirementLink).toBeInTheDocument();
        // The text is in a span inside an anchor
        expect(requirementLink.closest('a')).toHaveAttribute('href', 'https://example.com/requirements/auth');
        expect(requirementLink.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('renders config URLs as links', () => {
        render(<ControlsPanel controls={mockControls} />);

        const configLink = screen.getByText(/Config:.*https:\/\/example\.com\/config\/auth/);
        expect(configLink).toBeInTheDocument();
        // The text is inside an anchor
        expect(configLink.closest('a')).toHaveAttribute('href', 'https://example.com/config/auth');
    });

    it('renders applies-to nodes from config', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('node-2')).toBeInTheDocument();
    });

    it('renders applies-to relationships from config', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('rel-1')).toBeInTheDocument();
    });

    it('calls onNodeClick when clicking applies-to node', () => {
        const onNodeClick = vi.fn();
        render(<ControlsPanel controls={mockControls} onNodeClick={onNodeClick} />);

        fireEvent.click(screen.getByText('node-1'));

        expect(onNodeClick).toHaveBeenCalledWith('node-1');
    });

    it('renders AIGF Mapping section when mitigations or risks present', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('FINOS AIGF Mapping')).toBeInTheDocument();
    });

    it('renders AIGF mitigations', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('Mitigations:')).toBeInTheDocument();
        expect(screen.getByText('MIT-001, MIT-002')).toBeInTheDocument();
    });

    it('renders AIGF risks', () => {
        render(<ControlsPanel controls={mockControls} />);

        expect(screen.getByText('Risks:')).toBeInTheDocument();
        expect(screen.getByText('RISK-001')).toBeInTheDocument();
    });

    it('does not render AIGF Mapping for controls without it', () => {
        render(<ControlsPanel controls={{ 'control-1': mockControls['control-auth'] }} />);

        expect(screen.queryByText('FINOS AIGF Mapping')).not.toBeInTheDocument();
    });
});
