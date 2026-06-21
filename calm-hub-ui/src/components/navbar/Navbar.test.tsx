import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Navbar } from './Navbar.js';
import { UserAccessContext } from '../../admin/context/UserAccessContext.js';
import { CurrentUserAccessState } from '../../admin/hooks/useCurrentUserAccess.js';

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

function renderNavbar(state: CurrentUserAccessState) {
    return render(
        <UserAccessContext.Provider value={state}>
            <MemoryRouter>
                <Navbar />
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

    it('shows Hub and Visualizer links in the open menu', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^hub$/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /^visualizer$/i })).toBeInTheDocument();
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
