import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserMenu } from './UserMenu.js';

vi.mock('../../authService.js', () => ({
    getUser: vi.fn().mockResolvedValue({
        profile: {
            name: 'Shivaji Byrapaneni',
            preferred_username: 'shivaji.byrapaneni@fmr.com',
            email: 'shivaji.byrapaneni@fmr.com',
        },
    }),
    authService: {
        logout: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('UserMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show user initial and name when loaded', async () => {
        render(<UserMenu />);

        await waitFor(() => {
            expect(screen.getByText('S')).toBeDefined();
            expect(screen.getByText('Shivaji Byrapaneni')).toBeDefined();
        });
    });

    it('should show dropdown with email when clicked', async () => {
        render(<UserMenu />);

        await waitFor(() => {
            expect(screen.getByText('Shivaji Byrapaneni')).toBeDefined();
        });

        fireEvent.click(screen.getByLabelText('User menu'));

        expect(screen.getByText('shivaji.byrapaneni@fmr.com')).toBeDefined();
        expect(screen.getByText('Sign out')).toBeDefined();
    });

    it('should render nothing when no user', async () => {
        const { getUser } = await import('../../authService.js');
        vi.mocked(getUser).mockResolvedValue(null);

        const { container } = render(<UserMenu />);

        await waitFor(() => {
            expect(container.firstChild).toBeNull();
        });
    });
});
