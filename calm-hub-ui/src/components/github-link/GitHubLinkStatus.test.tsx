import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GitHubLinkStatus } from './GitHubLinkStatus.js';
import axios from 'axios';
import * as authConfig from '../../authConfig.js';

vi.mock('axios');
vi.mock('../../authService.js', () => ({
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}));

describe('GitHubLinkStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should render nothing when github linking is not enabled', () => {
        vi.spyOn(authConfig, 'isGitHubLinkingEnabled').mockReturnValue(false);

        const { container } = render(<GitHubLinkStatus />);

        expect(container.firstChild).toBeNull();
    });

    it('should show username when linked', async () => {
        vi.spyOn(authConfig, 'isGitHubLinkingEnabled').mockReturnValue(true);
        vi.mocked(axios.get).mockResolvedValue({
            data: { linked: true, username: 'alice-gh' },
        });

        render(<GitHubLinkStatus />);

        await waitFor(() => {
            expect(screen.getByText('GitHub: alice-gh')).toBeDefined();
        });
    });

    it('should show link button when not linked', async () => {
        vi.spyOn(authConfig, 'isGitHubLinkingEnabled').mockReturnValue(true);
        vi.mocked(axios.get).mockResolvedValue({
            data: { linked: false },
        });

        render(<GitHubLinkStatus />);

        await waitFor(() => {
            expect(screen.getByText('Link GitHub Account')).toBeDefined();
        });
    });

    it('should handle error gracefully', async () => {
        vi.spyOn(authConfig, 'isGitHubLinkingEnabled').mockReturnValue(true);
        vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

        render(<GitHubLinkStatus />);

        await waitFor(() => {
            expect(screen.getByText('Link GitHub Account')).toBeDefined();
        });
    });
});
