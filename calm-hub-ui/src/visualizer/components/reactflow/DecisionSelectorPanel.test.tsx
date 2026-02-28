import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecisionSelectorPanel } from './DecisionSelectorPanel';
import { DecisionPoint, DecisionSelections } from './utils/decisionUtils';

const twoDecisions: DecisionPoint[] = [
    {
        groupId: 'd1',
        decisionType: 'oneOf',
        prompt: 'Choose a client',
        choices: [
            { description: 'Use SPA', nodes: ['spa'], relationships: ['spa-to-svc'] },
            { description: 'Use Consumer Service', nodes: ['consumer'], relationships: ['consumer-to-svc'] },
        ],
    },
    {
        groupId: 'd2',
        decisionType: 'anyOf',
        prompt: 'Choose databases',
        choices: [
            { description: 'Postgres', nodes: ['pg'], relationships: ['svc-to-pg'] },
            { description: 'Mongo', nodes: ['mongo'], relationships: ['svc-to-mongo'] },
        ],
    },
];

function expandPanel() {
    fireEvent.click(screen.getByLabelText('Show decisions'));
}

describe('DecisionSelectorPanel', () => {
    const defaultProps = {
        decisionPoints: twoDecisions,
        selections: new Map() as DecisionSelections,
        onSelectionChange: vi.fn(),
        onReset: vi.fn(),
    };

    it('does not render when no decision points', () => {
        const { container } = render(
            <DecisionSelectorPanel {...defaultProps} decisionPoints={[]} />
        );
        expect(container.innerHTML).toBe('');
    });

    describe('collapsed state', () => {
        it('starts collapsed showing only a Decisions button', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expect(screen.getByLabelText('Show decisions')).toBeInTheDocument();
            expect(screen.queryByText('Choose a client')).not.toBeInTheDocument();
        });

        it('shows an indicator dot when selections are active', () => {
            const selections: DecisionSelections = new Map([['d1', [0]]]);
            const { container } = render(
                <DecisionSelectorPanel {...defaultProps} selections={selections} />
            );
            const dot = container.querySelector('span[style*="border-radius: 50%"]');
            expect(dot).toBeInTheDocument();
        });

        it('does not show indicator dot when no selections', () => {
            const { container } = render(<DecisionSelectorPanel {...defaultProps} />);
            const dot = container.querySelector('span[style*="border-radius: 50%"]');
            expect(dot).not.toBeInTheDocument();
        });

        it('expands when the Decisions button is clicked', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.getByText('Choose a client')).toBeInTheDocument();
            expect(screen.getByText('Choose databases')).toBeInTheDocument();
        });
    });

    describe('expanded state', () => {
        it('renders decision prompts', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.getByText('Choose a client')).toBeInTheDocument();
            expect(screen.getByText('Choose databases')).toBeInTheDocument();
        });

        it('renders type badges', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.getByText('oneOf')).toBeInTheDocument();
            expect(screen.getByText('anyOf')).toBeInTheDocument();
        });

        it('renders choice descriptions', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.getByText('Use SPA')).toBeInTheDocument();
            expect(screen.getByText('Use Consumer Service')).toBeInTheDocument();
            expect(screen.getByText('Postgres')).toBeInTheDocument();
            expect(screen.getByText('Mongo')).toBeInTheDocument();
        });

        it('renders radio buttons for oneOf decisions', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            const radios = screen.getAllByRole('radio');
            expect(radios).toHaveLength(2);
        });

        it('renders checkboxes for anyOf decisions', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes).toHaveLength(2);
        });

        it('calls onSelectionChange with index when radio is clicked', () => {
            const onSelectionChange = vi.fn();
            render(<DecisionSelectorPanel {...defaultProps} onSelectionChange={onSelectionChange} />);
            expandPanel();
            fireEvent.click(screen.getByText('Use SPA'));
            expect(onSelectionChange).toHaveBeenCalledWith('d1', [0]);
        });

        it('calls onSelectionChange with empty array when selected radio is clicked again', () => {
            const onSelectionChange = vi.fn();
            const selections: DecisionSelections = new Map([['d1', [0]]]);
            render(<DecisionSelectorPanel {...defaultProps} selections={selections} onSelectionChange={onSelectionChange} />);
            expandPanel();
            fireEvent.click(screen.getByText('Use SPA'));
            expect(onSelectionChange).toHaveBeenCalledWith('d1', []);
        });

        it('calls onSelectionChange toggling checkbox', () => {
            const onSelectionChange = vi.fn();
            render(<DecisionSelectorPanel {...defaultProps} onSelectionChange={onSelectionChange} />);
            expandPanel();
            fireEvent.click(screen.getByText('Postgres'));
            expect(onSelectionChange).toHaveBeenCalledWith('d2', [0]);
        });

        it('does not show Show All button when no selections are active', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.queryByText('Show All')).not.toBeInTheDocument();
        });

        it('shows Show All button when selections are active', () => {
            const selections: DecisionSelections = new Map([['d1', [0]]]);
            render(<DecisionSelectorPanel {...defaultProps} selections={selections} />);
            expandPanel();
            expect(screen.getByText('Show All')).toBeInTheDocument();
        });

        it('calls onReset when Show All is clicked', () => {
            const onReset = vi.fn();
            const selections: DecisionSelections = new Map([['d1', [0]]]);
            render(<DecisionSelectorPanel {...defaultProps} selections={selections} onReset={onReset} />);
            expandPanel();
            fireEvent.click(screen.getByText('Show All'));
            expect(onReset).toHaveBeenCalled();
        });

        it('collapses when close button is clicked', () => {
            render(<DecisionSelectorPanel {...defaultProps} />);
            expandPanel();
            expect(screen.getByText('Choose a client')).toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('Collapse decisions'));
            expect(screen.queryByText('Choose a client')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Show decisions')).toBeInTheDocument();
        });
    });
});
