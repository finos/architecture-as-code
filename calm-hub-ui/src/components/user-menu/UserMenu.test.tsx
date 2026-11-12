import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserMenu } from './UserMenu.js';

vi.mock('../../authService.js', () => ({
    getUser: vi.fn().mockResolvedValue({
        profile: {
            name: 'Alice Example',
            preferred_username: 'alice@example.com',
            email: 'alice@example.com',
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
            expect(screen.getByText('A')).toBeDefined();
            expect(screen.getByText('Alice Example')).toBeDefined();
        });
    });

    it('should show dropdown with email when clicked', async () => {
        render(<UserMenu />);

        await waitFor(() => {
            expect(screen.getByText('Alice Example')).toBeDefined();
        });

        fireEvent.click(screen.getByLabelText('User menu'));

        expect(screen.getByText('alice@example.com')).toBeDefined();
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
