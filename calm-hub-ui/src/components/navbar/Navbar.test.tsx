import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Navbar } from './Navbar.js';
import { UserAccessContext } from '../../admin/context/UserAccessContext.js';
import { CurrentUserAccessState } from '../../admin/hooks/useCurrentUserAccess.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { THEME_STORAGE_KEY } from '../../theme/useTheme.js';

function makeState(overrides: Partial<CurrentUserAccessState>): CurrentUserAccessState {
    return {
        grants: [],
        loading: false,
        error: null,
        isGlobalAdmin: false,
        canAdminNamespace: () => false,
        ...overrides,
    };
}

function renderNavbar(state: CurrentUserAccessState, storage: Storage = createMemoryStorage()) {
    return render(
        <UserAccessContext.Provider value={state}>
            <MemoryRouter>
                <Navbar storage={storage} />
            </MemoryRouter>
        </UserAccessContext.Provider>
    );
}

describe('Navbar menu button', () => {
    it('always renders the hamburger menu button', () => {
        renderNavbar(makeState({}));
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('opens the destinations overlay when the menu button is clicked', async () => {
        renderNavbar(makeState({}));
        const overlay = screen.getByRole('dialog', { hidden: true });
        expect(overlay).toHaveAttribute('aria-hidden', 'true');
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(overlay).toHaveAttribute('aria-hidden', 'false');
    });

    it('shows the Hub link in the open menu', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^hub$/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^visualizer$/i })).not.toBeInTheDocument();
    });

    it('closes the overlay when the hamburger is clicked again', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        await userEvent.click(screen.getByRole('button', { name: /close menu/i }));
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
    });
});

describe('Navbar Admin link visibility', () => {
    it('shows the Admin link in the open menu for a global admin', async () => {
        renderNavbar(makeState({ isGlobalAdmin: true }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^admin$/i })).toBeInTheDocument();
    });

    it('shows the Admin link in the open menu for a namespace-scoped admin', async () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'bob', permission: 'admin', namespace: 'finos' }],
        }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^admin$/i })).toBeInTheDocument();
    });

    it('hides the Admin link in the open menu for a read-only user', async () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'carol', permission: 'read', namespace: 'finos' }],
        }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link in the open menu while access is loading', async () => {
        renderNavbar(makeState({ loading: true }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link in the open menu when user has no grants', async () => {
        renderNavbar(makeState({ grants: [] }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });
});

describe('Navbar theme', () => {
    it('renders the theme toggle', () => {
        renderNavbar(makeState({}));
        expect(screen.getByRole('button', { name: /switch to .* theme/i })).toBeInTheDocument();
    });

    it('shows the two-tone lockup on light', () => {
        renderNavbar(makeState({}));
        expect(screen.getByAltText('CALM Logo')).toHaveAttribute(
            'src',
            '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo.svg'
        );
    });

    it('swaps to the white lockup on dark, which the navy one would not survive', () => {
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'dark');

        renderNavbar(makeState({}), storage);

        expect(screen.getByAltText('CALM Logo')).toHaveAttribute(
            'src',
            '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo_WHT.svg'
        );
    });

    it('uses a navbar lockup — never the full one with the tagline — in either theme', () => {
        const dark = createMemoryStorage();
        dark.setItem(THEME_STORAGE_KEY, 'dark');

        for (const storage of [createMemoryStorage(), dark]) {
            const { unmount } = renderNavbar(makeState({}), storage);
            expect(screen.getByAltText('CALM Logo').getAttribute('src')).toContain('Navbar_Logo');
            unmount();
        }
    });

    it('swaps the logo when the toggle is pressed, keeping it in step with the theme', async () => {
        renderNavbar(makeState({}));
        expect(screen.getByAltText('CALM Logo').getAttribute('src')).not.toContain('WHT');

        await userEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));

        // Guards against Navbar and ThemeToggle each holding their own useTheme state.
        expect(screen.getByAltText('CALM Logo').getAttribute('src')).toContain('WHT');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
});
