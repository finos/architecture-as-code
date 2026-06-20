import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AdminPage } from './AdminPage.js';
import { UserAccessContext } from './context/UserAccessContext.js';
import { CurrentUserAccessState } from './hooks/useCurrentUserAccess.js';
import { UserAccess } from '../model/user-access.js';

const globalAdminGrant: UserAccess = { userAccessId: 1, username: 'alice', permission: 'admin', namespace: 'GLOBAL' };
const nsAdminGrant: UserAccess = { userAccessId: 2, username: 'bob', permission: 'admin', namespace: 'finos' };
const readOnlyGrant: UserAccess = { userAccessId: 3, username: 'carol', permission: 'read', namespace: 'finos' };

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

function renderLayout(state: CurrentUserAccessState, initialPath = '/admin/entitlements') {
    return render(
        <UserAccessContext.Provider value={state}>
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route path="/admin" element={<AdminPage />}>
                        <Route path="namespaces" element={<div>Namespaces panel</div>} />
                        <Route path="domains" element={<div>Domains panel</div>} />
                        <Route path="entitlements" element={<div>Entitlements panel</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </UserAccessContext.Provider>
    );
}

const adminState = makeState({ isGlobalAdmin: true, grants: [globalAdminGrant] });
const nsAdminState = makeState({ grants: [nsAdminGrant] });
const readOnlyState = makeState({ grants: [readOnlyGrant] });
const loadingState = makeState({ loading: true });
const noGrantsState = makeState({});

describe('AdminPage (layout)', () => {
    it('renders all three sidebar navigation links for a global admin', () => {
        renderLayout(adminState);
        expect(screen.getByRole('link', { name: /namespaces/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /domains/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /entitlements/i })).toBeInTheDocument();
    });

    it('renders sidebar for a namespace-scoped admin', () => {
        renderLayout(nsAdminState);
        expect(screen.getByRole('link', { name: /namespaces/i })).toBeInTheDocument();
    });

    it('renders the active panel via Outlet', () => {
        renderLayout(adminState, '/admin/namespaces');
        expect(screen.getByText('Namespaces panel')).toBeInTheDocument();
    });

    it('renders the entitlements panel when at that sub-route', () => {
        renderLayout(adminState, '/admin/entitlements');
        expect(screen.getByText('Entitlements panel')).toBeInTheDocument();
    });

    it('renders the domains panel when at that sub-route', () => {
        renderLayout(adminState, '/admin/domains');
        expect(screen.getByText('Domains panel')).toBeInTheDocument();
    });
});

describe('AdminPage (access gate)', () => {
    it('shows a loading spinner while access is being checked', () => {
        renderLayout(loadingState);
        expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('shows access denied for a user with no admin grants', () => {
        renderLayout(readOnlyState);
        expect(screen.getByRole('alert')).toHaveTextContent(/do not have permission/i);
        expect(screen.queryByRole('link', { name: /namespaces/i })).not.toBeInTheDocument();
    });

    it('shows access denied for a user with no grants at all', () => {
        renderLayout(noGrantsState);
        expect(screen.getByRole('alert')).toHaveTextContent(/do not have permission/i);
    });
});
