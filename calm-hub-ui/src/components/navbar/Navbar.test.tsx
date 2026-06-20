import { render, screen } from '@testing-library/react';
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

describe('Navbar Admin link visibility', () => {
    it('shows the Admin link for a global admin', () => {
        renderNavbar(makeState({ isGlobalAdmin: true }));
        expect(screen.getAllByRole('link', { name: /admin/i }).length).toBeGreaterThan(0);
    });

    it('shows the Admin link for a namespace-scoped admin', () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'bob', permission: 'admin', namespace: 'finos' }],
        }));
        expect(screen.getAllByRole('link', { name: /admin/i }).length).toBeGreaterThan(0);
    });

    it('hides the Admin link for a read-only user', () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'carol', permission: 'read', namespace: 'finos' }],
        }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link while access is loading', () => {
        renderNavbar(makeState({ loading: true }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link when user has no grants', () => {
        renderNavbar(makeState({ grants: [] }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('always shows Hub and Visualizer links', () => {
        renderNavbar(makeState({}));
        expect(screen.getAllByRole('link', { name: /hub/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: /visualizer/i }).length).toBeGreaterThan(0);
    });
});
