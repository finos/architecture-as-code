import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ControlCard } from './ControlCard.js';

const HREF = '/security/controls/5/detail';

const renderCard = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ControlCard', () => {
    it('renders the control name, description, Control pill and mono id', () => {
        renderCard(
            <ControlCard
                name="Encryption at rest"
                description="All persisted data must be encrypted."
                controlId={5}
                href={HREF}
            />
        );

        expect(screen.getByText('Encryption at rest')).toBeInTheDocument();
        expect(screen.getByText('All persisted data must be encrypted.')).toBeInTheDocument();
        expect(screen.getByText('Control')).toBeInTheDocument();
        expect(screen.getByText('#5')).toBeInTheDocument();
    });

    it('is a link to the control deep link, not a toggle button', () => {
        renderCard(<ControlCard name="Access Control" controlId={5} href={HREF} />);

        const card = screen.getByTestId('control-card');
        expect(card).toHaveAttribute('href', HREF);
        expect(card).not.toHaveAttribute('aria-pressed');
    });

    it('renders without a description', () => {
        renderCard(<ControlCard name="Audit Logging" controlId={9} href={HREF} />);

        expect(screen.getByText('Audit Logging')).toBeInTheDocument();
        expect(screen.getByText('#9')).toBeInTheDocument();
        // No description paragraph rendered.
        expect(screen.queryByText(/must be/i)).not.toBeInTheDocument();
    });
});
