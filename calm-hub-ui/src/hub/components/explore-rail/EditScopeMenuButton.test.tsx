import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditScopeMenuButton } from './EditScopeMenuButton.js';
import { colors } from '../../../theme/colors.js';

describe('EditScopeMenuButton', () => {
    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Filter options' }));

    it('opens a menu that marks the current scope', () => {
        render(<EditScopeMenuButton scope="all" onChange={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Filter options' });
        expect(button).toHaveAttribute('aria-expanded', 'false');

        openMenu();

        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menuitemradio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: 'Can edit' })).toHaveAttribute('aria-checked', 'false');
    });

    it('reports the chosen scope and closes the menu', () => {
        const onChange = vi.fn();
        render(<EditScopeMenuButton scope="all" onChange={onChange} />);
        openMenu();
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Can edit' }));
        expect(onChange).toHaveBeenCalledWith('editable');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes on Escape', () => {
        render(<EditScopeMenuButton scope="all" onChange={vi.fn()} />);
        openMenu();
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes when focus moves outside, but not when it moves into the menu', () => {
        render(
            <>
                <EditScopeMenuButton scope="all" onChange={vi.fn()} />
                <button type="button">elsewhere</button>
            </>
        );
        openMenu();
        const button = screen.getByRole('button', { name: 'Filter options' });

        fireEvent.blur(button, { relatedTarget: screen.getByRole('menuitemradio', { name: 'All' }) });
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.blur(button, { relatedTarget: screen.getByRole('button', { name: 'elsewhere' }) });
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows the active state while Can edit is on', () => {
        render(<EditScopeMenuButton scope="editable" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Filter options' })).toHaveStyle({ backgroundColor: colors.redesign.tintBg });
    });

    it('has no active background while All is on', () => {
        render(<EditScopeMenuButton scope="all" onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Filter options' })).not.toHaveStyle({ backgroundColor: colors.redesign.tintBg });
    });
});
