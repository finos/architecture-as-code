import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogoutButton } from './LogoutButton.js';
import { authService } from '../../authService.js';

vi.mock('../../authService.js', () => ({
    authService: {
        logout: vi.fn(),
    },
}));

describe('LogoutButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a logout button', () => {
        render(<LogoutButton />);
        const button = screen.getByRole('button', { name: /logout/i });
        expect(button).toBeInTheDocument();
    });

    it('has correct styling', () => {
        render(<LogoutButton />);
        const button = screen.getByRole('button', { name: /logout/i });
        expect(button).toHaveStyle({
            position: 'absolute',
            top: '10px',
            right: '10px',
        });
    });

    it('calls authService.logout when clicked', async () => {
        render(<LogoutButton />);
        const button = screen.getByRole('button', { name: /logout/i });

        fireEvent.click(button);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(authService.logout).toHaveBeenCalled();
    });

    it('button text is "Logout"', () => {
        render(<LogoutButton />);
        const button = screen.getByRole('button');
        expect(button.textContent).toBe('Logout');
    });
});

