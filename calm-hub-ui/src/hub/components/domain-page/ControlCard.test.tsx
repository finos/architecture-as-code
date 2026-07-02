import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ControlCard } from './ControlCard.js';

describe('ControlCard', () => {
    it('renders the control name, description, Control pill and mono id', () => {
        render(
            <ControlCard
                name="Encryption at rest"
                description="All persisted data must be encrypted."
                controlId={5}
                onActivate={vi.fn()}
            />
        );

        expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
        expect(screen.getByText('All persisted data must be encrypted.')).toBeInTheDocument();
        expect(screen.getByText('Control')).toBeInTheDocument();
        expect(screen.getByText('#5')).toBeInTheDocument();
    });

    it('activates the card when clicked', () => {
        const onActivate = vi.fn();
        render(<ControlCard name="Access Control" controlId={6} onActivate={onActivate} />);

        fireEvent.click(screen.getByTestId('control-card'));

        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('marks the card as selected (aria-pressed) when active', () => {
        render(<ControlCard name="Encryption" controlId={5} active onActivate={vi.fn()} />);
        expect(screen.getByTestId('control-card')).toHaveAttribute('aria-pressed', 'true');
    });

    it('is not pressed when inactive (default)', () => {
        render(<ControlCard name="Encryption" controlId={5} onActivate={vi.fn()} />);
        expect(screen.getByTestId('control-card')).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders without a description', () => {
        render(<ControlCard name="Audit Logging" controlId={9} onActivate={vi.fn()} />);

        expect(screen.getByText('Audit Logging')).toBeInTheDocument();
        expect(screen.getByText('#9')).toBeInTheDocument();
        // No description paragraph rendered.
        expect(screen.queryByText(/must be/i)).not.toBeInTheDocument();
    });
});
