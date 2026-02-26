import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EdgeTooltip } from './EdgeTooltip';

describe('EdgeTooltip', () => {
    const defaultProps = {
        description: 'Test connection',
        protocol: '',
        direction: undefined,
        flowTransitions: [],
        edgeControls: {},
        controlsApplied: [],
        mitigations: [],
        risks: [],
        labelX: 100,
        labelY: 100,
    };

    it('renders description', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.getByText('Test connection')).toBeInTheDocument();
    });

    it('renders protocol when provided', () => {
        render(<EdgeTooltip {...defaultProps} protocol="HTTPS" />);
        expect(screen.getByText('Protocol:')).toBeInTheDocument();
        expect(screen.getByText('HTTPS')).toBeInTheDocument();
    });

    it('does not render protocol section when not provided', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText('Protocol:')).not.toBeInTheDocument();
    });

    it('renders flow transitions', () => {
        const flowTransitions = [
            { sequence: 1, flowName: 'Request Flow', description: 'Send request' },
            { sequence: 2, flowName: 'Request Flow', description: 'Receive response' },
        ];
        render(<EdgeTooltip {...defaultProps} flowTransitions={flowTransitions} />);

        expect(screen.getByText(/Flow Transitions/)).toBeInTheDocument();
        expect(screen.getByText(/Step.*1/)).toBeInTheDocument();
        expect(screen.getByText(/Step.*2/)).toBeInTheDocument();
        expect(screen.getByText('Send request')).toBeInTheDocument();
        expect(screen.getByText('Receive response')).toBeInTheDocument();
    });

    it('renders flow transitions with direction', () => {
        const flowTransitions = [
            { sequence: 1, flowName: 'Flow', description: 'Step' },
        ];
        render(<EdgeTooltip {...defaultProps} flowTransitions={flowTransitions} direction="forward" />);

        expect(screen.getByText('(forward)')).toBeInTheDocument();
    });

    it('does not render flow transitions section when empty', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText(/Flow Transitions/)).not.toBeInTheDocument();
    });

    it('renders edge controls', () => {
        const edgeControls = {
            'control-1': { description: 'TLS encryption' },
            'control-2': { description: 'Authentication required' },
        };
        render(<EdgeTooltip {...defaultProps} edgeControls={edgeControls} />);

        expect(screen.getByText('Connection Controls:')).toBeInTheDocument();
        expect(screen.getByText('control-1')).toBeInTheDocument();
        expect(screen.getByText('TLS encryption')).toBeInTheDocument();
        expect(screen.getByText('control-2')).toBeInTheDocument();
    });

    it('does not render edge controls section when empty', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText('Connection Controls:')).not.toBeInTheDocument();
    });

    it('renders controls applied', () => {
        const controlsApplied = ['TLS-1.3', 'OAuth2'];
        render(<EdgeTooltip {...defaultProps} controlsApplied={controlsApplied} />);

        expect(screen.getByText('Controls Applied:')).toBeInTheDocument();
        expect(screen.getByText('TLS-1.3')).toBeInTheDocument();
        expect(screen.getByText('OAuth2')).toBeInTheDocument();
    });

    it('does not render controls applied section when empty', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText('Controls Applied:')).not.toBeInTheDocument();
    });

    it('renders mitigations as strings', () => {
        const mitigations = ['Mitigation 1', 'Mitigation 2'];
        render(<EdgeTooltip {...defaultProps} mitigations={mitigations} />);

        expect(screen.getByText('Mitigations:')).toBeInTheDocument();
        expect(screen.getByText('Mitigation 1')).toBeInTheDocument();
        expect(screen.getByText('Mitigation 2')).toBeInTheDocument();
    });

    it('renders mitigations as objects with id and name', () => {
        const mitigations = [
            { id: 'MIT-001', name: 'Input validation' },
        ];
        render(<EdgeTooltip {...defaultProps} mitigations={mitigations} />);

        expect(screen.getByText('Mitigations:')).toBeInTheDocument();
        expect(screen.getByText('MIT-001')).toBeInTheDocument();
        expect(screen.getByText('- Input validation')).toBeInTheDocument();
    });

    it('does not render mitigations section when empty', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText('Mitigations:')).not.toBeInTheDocument();
    });

    it('renders risks as strings', () => {
        const risks = ['Risk 1', 'Risk 2'];
        render(<EdgeTooltip {...defaultProps} risks={risks} />);

        expect(screen.getByText('Risks:')).toBeInTheDocument();
        expect(screen.getByText('Risk 1')).toBeInTheDocument();
        expect(screen.getByText('Risk 2')).toBeInTheDocument();
    });

    it('renders risks as objects with id and name', () => {
        const risks = [
            { id: 'RISK-001', name: 'Data exposure' },
        ];
        render(<EdgeTooltip {...defaultProps} risks={risks} />);

        expect(screen.getByText('Risks:')).toBeInTheDocument();
        expect(screen.getByText('RISK-001')).toBeInTheDocument();
        expect(screen.getByText('- Data exposure')).toBeInTheDocument();
    });

    it('does not render risks section when empty', () => {
        render(<EdgeTooltip {...defaultProps} />);
        expect(screen.queryByText('Risks:')).not.toBeInTheDocument();
    });

    it('renders flow name in transitions', () => {
        const flowTransitions = [
            { sequence: 1, flowName: 'Authentication Flow', description: 'Login' },
        ];
        render(<EdgeTooltip {...defaultProps} flowTransitions={flowTransitions} />);

        expect(screen.getByText('in Authentication Flow')).toBeInTheDocument();
    });
});
