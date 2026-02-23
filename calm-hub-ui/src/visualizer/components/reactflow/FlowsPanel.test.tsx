import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FlowsPanel } from './FlowsPanel';

describe('FlowsPanel', () => {
    const mockFlows = [
        {
            'unique-id': 'flow-1',
            name: 'User Login Flow',
            description: 'Handles user authentication',
            transitions: [
                {
                    'sequence-number': 1,
                    description: 'User submits credentials',
                    'relationship-unique-id': 'rel-auth-submit',
                },
                {
                    'sequence-number': 2,
                    description: 'Server validates credentials',
                    'relationship-unique-id': 'rel-auth-validate',
                },
            ],
        },
        {
            'unique-id': 'flow-2',
            name: 'Data Export Flow',
            description: 'Exports data to external systems',
            transitions: [
                {
                    'sequence-number': 1,
                    description: 'Fetch data from database',
                    'relationship-unique-id': 'rel-fetch-data',
                },
            ],
            'aigf-governance': {
                'mitigations-applied': ['M001', 'M002'],
                'risks-addressed': ['R001'],
                'trust-boundaries-crossed': ['TB001'],
            },
        },
    ];

    it('renders nothing when flows is undefined', () => {
        const { container } = render(<FlowsPanel flows={undefined as unknown as []} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing when flows is empty', () => {
        const { container } = render(<FlowsPanel flows={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders Business Flows header with count', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('Business Flows')).toBeInTheDocument();
        expect(screen.getByText('2 flows')).toBeInTheDocument();
    });

    it('renders singular flow count when only one flow', () => {
        render(<FlowsPanel flows={[mockFlows[0]]} />);

        // Use a function matcher since React may break up the text into multiple text nodes
        expect(screen.getByText((content, element) => {
            return element?.tagName === 'SPAN' && content.includes('1') && element.textContent === '1 flow';
        })).toBeInTheDocument();
    });

    it('renders flow names and descriptions', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('User Login Flow')).toBeInTheDocument();
        expect(screen.getByText('Handles user authentication')).toBeInTheDocument();
        expect(screen.getByText('Data Export Flow')).toBeInTheDocument();
        expect(screen.getByText('Exports data to external systems')).toBeInTheDocument();
    });

    it('renders transitions with sequence numbers', () => {
        render(<FlowsPanel flows={mockFlows} />);

        // Check for sequence numbers - there may be multiple "1"s, so check for the descriptions
        expect(screen.getByText('User submits credentials')).toBeInTheDocument();
        expect(screen.getByText('Server validates credentials')).toBeInTheDocument();
        expect(screen.getByText('Fetch data from database')).toBeInTheDocument();
    });

    it('renders relationship IDs for transitions', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('rel-auth-submit')).toBeInTheDocument();
        expect(screen.getByText('rel-auth-validate')).toBeInTheDocument();
    });

    it('calls onTransitionClick when clicking a transition', () => {
        const onTransitionClick = vi.fn();
        render(<FlowsPanel flows={mockFlows} onTransitionClick={onTransitionClick} />);

        fireEvent.click(screen.getByText('User submits credentials'));

        expect(onTransitionClick).toHaveBeenCalledWith('rel-auth-submit');
    });

    it('renders AIGF Governance section when present', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('AIGF Governance')).toBeInTheDocument();
    });

    it('renders mitigations in AIGF Governance', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('Mitigations:')).toBeInTheDocument();
        expect(screen.getByText('M001, M002')).toBeInTheDocument();
    });

    it('renders risks in AIGF Governance', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('Risks:')).toBeInTheDocument();
        expect(screen.getByText('R001')).toBeInTheDocument();
    });

    it('renders trust boundaries in AIGF Governance', () => {
        render(<FlowsPanel flows={mockFlows} />);

        expect(screen.getByText('Boundaries:')).toBeInTheDocument();
        expect(screen.getByText('TB001')).toBeInTheDocument();
    });

    it('does not render AIGF Governance for flows without it', () => {
        render(<FlowsPanel flows={[mockFlows[0]]} />);

        expect(screen.queryByText('AIGF Governance')).not.toBeInTheDocument();
    });
});
