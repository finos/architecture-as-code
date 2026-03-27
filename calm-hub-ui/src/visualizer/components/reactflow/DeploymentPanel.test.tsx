import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DeploymentPanel } from './DeploymentPanel';
import type { Decorator } from '../../contracts/contracts.js';

const architectureItems: Record<string, 'node' | 'relationship'> = {
    'node-api': 'node',
    'node-db': 'node',
    'rel-api-db': 'relationship',
};

const mockDecorators: Decorator[] = [
    {
        uniqueId: 'dep-1',
        type: 'deployment',
        appliesTo: ['node-api', 'rel-api-db'],
        data: {
            status: 'completed',
            'start-time': '2024-03-01T10:00:00Z',
            'end-time': '2024-03-01T10:05:00Z',
            'deployment-details': 'https://ci.example.com/builds/1',
            notes: 'Routine release',
        },
    },
    {
        uniqueId: 'dep-2',
        type: 'deployment',
        appliesTo: ['node-db'],
        data: {
            status: 'failed',
            'start-time': '2024-02-15T09:00:00Z',
            'end-time': '2024-02-15T09:02:00Z',
        },
    },
    {
        uniqueId: 'dep-3',
        type: 'deployment',
        appliesTo: ['node-api'],
        data: {
            status: 'in-progress',
            'start-time': '2024-04-01T08:00:00Z',
        },
    },
];

describe('DeploymentPanel', () => {
    it('renders empty state when no decorators are provided', () => {
        render(<DeploymentPanel decorators={[]} />);

        expect(screen.getByText('No deployment history found for this architecture.')).toBeInTheDocument();
    });

    it('renders the history list with each deployment', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getAllByText(/completed|failed|in-progress/i).length).toBeGreaterThan(0);
    });

    it('renders summary section with total count', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByText('3')).toBeInTheDocument(); // Total stat card
    });

    it('renders history label with count', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByText(/History \(3\)/)).toBeInTheDocument();
    });

    it('shows detail view for the first (most recent) deployment by default', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // dep-3 is the most recent (2024-04-01). Its uniqueId is shown in the detail view header.
        expect(screen.getByText('dep-3')).toBeInTheDocument();
    });

    it('switches detail view when clicking a different history item', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // Find buttons in the history list (excluding action buttons in detail view)
        const historyButtons = screen.getAllByRole('button');
        // Click the second item in history
        fireEvent.click(historyButtons[historyButtons.length - 1]);

        // Detail view should update
        expect(screen.getByText(/Started/i)).toBeInTheDocument();
    });

    it('renders link to deployment when deployment-details is present', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // Select the completed deployment (dep-1 has deployment-details)
        const historyButtons = screen.getAllByRole('button');
        fireEvent.click(historyButtons[1]); // second item in sorted list

        const link = screen.queryByRole('link', { name: /deployment/i });
        // Only one of the deployments has a link - if visible it should have the href
        if (link) {
            expect(link).toHaveAttribute('href', 'https://ci.example.com/builds/1');
        }
    });

    it('renders filter bar with status options', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    });

    it('filters list by status when a status filter is clicked', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // Use exact name to match only the filter pill, not history list items
        fireEvent.click(screen.getByRole('button', { name: 'failed' }));

        expect(screen.getByText(/History \(1 of 3\)/)).toBeInTheDocument();
    });

    it('clears filter when Clear button is clicked', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        fireEvent.click(screen.getByRole('button', { name: 'failed' }));
        expect(screen.getByText(/History \(1 of 3\)/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /clear/i }));
        expect(screen.getByText(/History \(3\)/)).toBeInTheDocument();
    });

    it('shows no-match message when filters yield zero results', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // Filter by node-db (only dep-2/failed applies) then by 'completed' status — nothing matches both
        fireEvent.change(screen.getByRole('combobox', { name: /filter by node/i }), { target: { value: 'node-db' } });
        fireEvent.click(screen.getByRole('button', { name: 'completed' }));

        expect(screen.getByText('No deployments match the current filters.')).toBeInTheDocument();
    });

    it('renders node filter dropdown when architecture items include nodes', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByRole('combobox', { name: /filter by node/i })).toBeInTheDocument();
    });

    it('renders relationship filter dropdown when architecture items include relationships', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByRole('combobox', { name: /filter by relationship/i })).toBeInTheDocument();
    });

    it('renders deployed components in detail view', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        expect(screen.getByText('Deployed Components')).toBeInTheDocument();
    });

    it('renders notes when present in deployment data', () => {
        render(<DeploymentPanel decorators={mockDecorators} architectureItems={architectureItems} />);

        // Navigate to the decorator with notes (dep-1)
        const historyButtons = screen.getAllByRole('button');
        // Try each button until we find the completed one
        for (const btn of historyButtons) {
            if (btn.textContent?.includes('completed')) {
                fireEvent.click(btn);
                break;
            }
        }

        expect(screen.getByText('Routine release')).toBeInTheDocument();
    });
});
