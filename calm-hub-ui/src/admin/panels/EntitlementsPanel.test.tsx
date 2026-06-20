import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitlementsPanel } from './EntitlementsPanel.js';
import { CalmService } from '../../service/calm-service.js';
import { UserAccessService } from '../../service/user-access-service.js';
import { UserAccessContext } from '../context/UserAccessContext.js';
import { CurrentUserAccessState } from '../hooks/useCurrentUserAccess.js';

const NS_FINOS = 'finos';
const NS_PAYMENTS = 'payments';

function makeAccessState(overrides: Partial<CurrentUserAccessState>): CurrentUserAccessState {
    return {
        grants: [],
        loading: false,
        error: null,
        isGlobalAdmin: false,
        canAdminNamespace: () => false,
        ...overrides,
    };
}

const globalAdminState = makeAccessState({
    isGlobalAdmin: true,
    canAdminNamespace: () => true,
});

function mockServices(namespaces: string[], domains: string[] = []) {
    const calmSvc = new CalmService();
    vi.spyOn(calmSvc, 'fetchNamespaces').mockResolvedValue(namespaces);
    vi.spyOn(calmSvc, 'fetchDomains').mockResolvedValue(domains);

    const userAccessSvc = new UserAccessService();
    vi.spyOn(userAccessSvc, 'getNamespaceUserAccess').mockResolvedValue([]);
    vi.spyOn(userAccessSvc, 'getDomainUserAccess').mockResolvedValue([]);

    return { calmSvc, userAccessSvc };
}

function renderPanel(
    accessState: CurrentUserAccessState,
    calmSvc: CalmService,
    userAccessSvc: UserAccessService
) {
    return render(
        <UserAccessContext.Provider value={accessState}>
            <BrowserRouter>
                <EntitlementsPanel calmService={calmSvc} userAccessService={userAccessSvc} />
            </BrowserRouter>
        </UserAccessContext.Provider>
    );
}

beforeEach(() => vi.clearAllMocks());

describe('EntitlementsPanel', () => {

    describe('loading state', () => {
        it('shows a loading spinner while access state is loading', () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(makeAccessState({ loading: true }), calmSvc, userAccessSvc);
            expect(screen.getByLabelText('Loading')).toBeInTheDocument();
        });

        it('hides the spinner after access state loads', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(
                makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS }),
                calmSvc,
                userAccessSvc
            );
            await waitFor(() =>
                expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
            );
        });
    });

    describe('no admin access', () => {
        it('shows "no access" message when user has no admin namespaces', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(makeAccessState({}), calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('status')).toHaveTextContent(/no admin access/i)
            );
        });
    });

    describe('namespace dropdown', () => {
        it('shows adminnable namespaces as dropdown options', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS, NS_PAYMENTS]);
            renderPanel(
                makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS || ns === NS_PAYMENTS }),
                calmSvc,
                userAccessSvc
            );
            const select = await screen.findByRole('combobox', { name: /select namespace/i });
            expect(select).toBeInTheDocument();
            expect(screen.getByRole('option', { name: NS_FINOS })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: NS_PAYMENTS })).toBeInTheDocument();
        });

        it('only shows namespaces the user can admin', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS, NS_PAYMENTS]);
            renderPanel(
                makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS }),
                calmSvc,
                userAccessSvc
            );
            await screen.findByRole('combobox', { name: /select namespace/i });
            expect(screen.getByRole('option', { name: NS_FINOS })).toBeInTheDocument();
            expect(screen.queryByRole('option', { name: NS_PAYMENTS })).not.toBeInTheDocument();
        });

        it('shows all namespaces when user is global admin', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS, NS_PAYMENTS]);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await screen.findByRole('combobox', { name: /select namespace/i });
            expect(screen.getByRole('option', { name: NS_FINOS })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: NS_PAYMENTS })).toBeInTheDocument();
        });

        it('renders the panel for the selected namespace', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS, NS_PAYMENTS]);
            renderPanel(
                makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS || ns === NS_PAYMENTS }),
                calmSvc,
                userAccessSvc
            );
            const select = await screen.findByRole('combobox', { name: /select namespace/i });
            fireEvent.change(select, { target: { value: NS_FINOS } });
            await waitFor(() =>
                expect(screen.getByRole('heading', { name: NS_FINOS })).toBeInTheDocument()
            );
            expect(screen.queryByRole('heading', { name: NS_PAYMENTS })).not.toBeInTheDocument();
        });
    });

    describe('global admin sections', () => {
        it('shows Domain Access section for global admins', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('region', { name: /domain access/i })).toBeInTheDocument()
            );
        });

        it('does not show Domain Access section for namespace-scoped admins', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS }), calmSvc, userAccessSvc);
            await screen.findByRole('combobox', { name: /select namespace/i });
            expect(screen.queryByRole('region', { name: /domain access/i })).not.toBeInTheDocument();
        });

        it('shows Global Admin Access section for global admins', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('region', { name: /global admin access/i })).toBeInTheDocument()
            );
        });

        it('does not show Global Admin Access section for namespace-scoped admins', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(makeAccessState({ canAdminNamespace: (ns) => ns === NS_FINOS }), calmSvc, userAccessSvc);
            await screen.findByRole('combobox', { name: /select namespace/i });
            expect(screen.queryByRole('region', { name: /global admin access/i })).not.toBeInTheDocument();
        });

        it('loads GLOBAL namespace grants in the Global Admin Access panel', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('region', { name: /global admin access/i })).toBeInTheDocument()
            );
            expect(userAccessSvc.getNamespaceUserAccess).toHaveBeenCalledWith('GLOBAL');
        });
    });

    describe('domain dropdown', () => {
        it('shows all domains as dropdown options when global admin', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS], ['retail', 'wholesale']);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await screen.findByRole('combobox', { name: /select domain/i });
            expect(screen.getByRole('option', { name: 'retail' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'wholesale' })).toBeInTheDocument();
        });

        it('renders the panel for the selected domain', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS], ['retail', 'wholesale']);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            const select = await screen.findByRole('combobox', { name: /select domain/i });
            fireEvent.change(select, { target: { value: 'retail' } });
            await waitFor(() =>
                expect(screen.getByRole('heading', { name: 'retail' })).toBeInTheDocument()
            );
            expect(screen.queryByRole('heading', { name: 'wholesale' })).not.toBeInTheDocument();
        });

        it('shows "no domains found" when there are no domains', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS], []);
            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByText(/no domains found/i)).toBeInTheDocument()
            );
        });
    });

    describe('error states', () => {
        it('shows an error when namespace fetch fails', async () => {
            const calmSvc = new CalmService();
            vi.spyOn(calmSvc, 'fetchNamespaces').mockRejectedValue(new Error('fail'));
            vi.spyOn(calmSvc, 'fetchDomains').mockResolvedValue([]);
            const userAccessSvc = new UserAccessService();
            vi.spyOn(userAccessSvc, 'getNamespaceUserAccess').mockResolvedValue([]);
            vi.spyOn(userAccessSvc, 'getDomainUserAccess').mockResolvedValue([]);

            renderPanel(globalAdminState, calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load namespaces/i)
            );
        });

        it('shows an error when access state has an error', async () => {
            const { calmSvc, userAccessSvc } = mockServices([NS_FINOS]);
            renderPanel(
                makeAccessState({ error: 'Failed to load your access permissions.' }),
                calmSvc,
                userAccessSvc
            );
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load your access/i)
            );
        });
    });

    describe('panel heading', () => {
        it('renders the Access Management heading', async () => {
            const { calmSvc, userAccessSvc } = mockServices([], []);
            renderPanel(makeAccessState({}), calmSvc, userAccessSvc);
            await waitFor(() =>
                expect(screen.getByRole('heading', { name: /access management/i })).toBeInTheDocument()
            );
        });
    });
});
