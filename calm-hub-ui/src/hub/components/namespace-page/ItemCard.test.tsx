import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ItemCard } from './ItemCard.js';

describe('ItemCard', () => {
    it('renders the name, description and a type badge', () => {
        render(
            <ItemCard
                name="TraderX Architecture"
                description="Simple trading-system reference architecture."
                type="Architectures"
                onActivate={() => {}}
            />
        );
        expect(screen.getByText('TraderX Architecture')).toBeInTheDocument();
        expect(
            screen.getByText('Simple trading-system reference architecture.')
        ).toBeInTheDocument();
        expect(screen.getByTestId('type-badge')).toHaveTextContent('Architecture');
    });

    it('calls onActivate when the card is clicked', () => {
        const onActivate = vi.fn();
        render(<ItemCard name="Settlement Service" type="Architectures" onActivate={onActivate} />);
        fireEvent.click(screen.getByTestId('item-card'));
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('exposes a single button whose accessible name is the item name', () => {
        render(
            <ItemCard
                name="Settlement Service"
                description="Clears and settles trades."
                type="Architectures"
                customId="settlement-service"
                onActivate={() => {}}
            />
        );
        // The activation control is a button named after the item only — not the
        // description / badge / customId (which sit outside the <button>).
        const button = screen.getByRole('button', { name: 'Settlement Service' });
        expect(button).toBe(screen.getByTestId('item-card'));
    });

    it('uses valid markup: an <article> wrapper around the button (not a button wrapping blocks)', () => {
        const { container } = render(
            <ItemCard name="Account Service" type="Architectures" onActivate={() => {}} />
        );
        const article = container.querySelector('article');
        expect(article).toBeInTheDocument();
        // The activation button is nested inside the article, and there is exactly one button.
        expect(article?.querySelectorAll('button')).toHaveLength(1);
    });

    it('exposes a brand-coloured focus-visible ring on the activation button', () => {
        render(<ItemCard name="Focus Me" type="Architectures" onActivate={() => {}} />);
        const button = screen.getByTestId('item-card');
        expect(button.className).toContain('focus-visible:outline-2');
        expect(button.className).toContain('focus-visible:outline-[var(--color-interaction)]');
    });

    it('omits the description paragraph when none is provided', () => {
        render(<ItemCard name="No Desc" type="Flows" onActivate={() => {}} />);
        // Only the name and the badge label render as text content.
        expect(screen.getByText('No Desc')).toBeInTheDocument();
        expect(screen.getByTestId('type-badge')).toHaveTextContent('Flow');
    });

    it('shows the customId as mono meta when no version count is provided', () => {
        render(
            <ItemCard
                name="Account Service"
                type="Architectures"
                customId="account-service"
                onActivate={() => {}}
            />
        );
        expect(screen.getByText('account-service')).toBeInTheDocument();
        expect(screen.queryByText(/version/i)).not.toBeInTheDocument();
    });

    it('shows the "N versions" scent (plural) when a version count is provided', () => {
        render(
            <ItemCard
                name="Position Service"
                type="Architectures"
                customId="position-service"
                versionCount={3}
                onActivate={() => {}}
            />
        );
        expect(screen.getByText('3 versions')).toBeInTheDocument();
        // The version scent replaces the customId fallback.
        expect(screen.queryByText('position-service')).not.toBeInTheDocument();
    });

    it('uses the singular "1 version" when there is exactly one version', () => {
        render(
            <ItemCard
                name="Position Service"
                type="Architectures"
                customId="position-service"
                versionCount={1}
                onActivate={() => {}}
            />
        );
        expect(screen.getByText('1 version')).toBeInTheDocument();
    });
});
