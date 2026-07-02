import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from './EmptyState.js';

describe('EmptyState', () => {
    it('renders the message', () => {
        render(<EmptyState message="No patterns in this namespace yet" />);
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText('No patterns in this namespace yet')).toBeInTheDocument();
    });

    it('renders a default icon when none is supplied', () => {
        const { container } = render(<EmptyState message="Nothing here" />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders a provided CTA', () => {
        render(<EmptyState message="Nothing here" cta={<button>Add one</button>} />);
        expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument();
    });
});
