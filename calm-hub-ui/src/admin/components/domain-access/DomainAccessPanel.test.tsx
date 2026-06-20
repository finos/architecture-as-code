import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainAccessPanel } from './DomainAccessPanel.js';
import { UserAccessService } from '../../../service/user-access-service.js';
import { UserAccess } from '../../../model/user-access.js';

const readGrant: UserAccess = { userAccessId: 1, username: 'alice', permission: 'read', domain: 'retail' };
const adminGrant: UserAccess = { userAccessId: 2, username: 'bob', permission: 'admin', domain: 'retail' };
const wildcardGrant: UserAccess = { userAccessId: 3, username: '*', permission: 'read', domain: 'retail' };

function mockSvc(overrides: Partial<Record<keyof UserAccessService, unknown>> = {}): UserAccessService {
    const svc = new UserAccessService();
    vi.spyOn(svc, 'getDomainUserAccess').mockResolvedValue([readGrant, adminGrant]);
    vi.spyOn(svc, 'grantDomainAccess').mockResolvedValue(undefined);
    vi.spyOn(svc, 'revokeDomainAccess').mockResolvedValue(undefined);
    Object.entries(overrides).forEach(([k, v]) => {
        vi.spyOn(svc, k as keyof UserAccessService).mockImplementation(v as never);
    });
    return svc;
}

beforeEach(() => vi.clearAllMocks());

describe('DomainAccessPanel', () => {

    describe('loading and fetching', () => {
        it('shows a loading spinner initially', () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            expect(screen.getByLabelText('Loading grants')).toBeInTheDocument();
        });

        it('renders grant rows after loading', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
            expect(screen.getByText('bob')).toBeInTheDocument();
        });

        it('shows empty state when no grants exist', async () => {
            const svc = mockSvc({ getDomainUserAccess: () => Promise.resolve([]) });
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() =>
                expect(screen.getByText(/no access grants/i)).toBeInTheDocument()
            );
        });

        it('shows an error message when fetch fails', async () => {
            const svc = mockSvc({ getDomainUserAccess: () => Promise.reject(new Error('fail')) });
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i)
            );
        });

        it('displays the domain name', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => expect(screen.getByText('retail')).toBeInTheDocument());
        });
    });

    describe('sorting', () => {
        it('renders grants sorted alphabetically by username', async () => {
            const svc = mockSvc({
                getDomainUserAccess: () => Promise.resolve([adminGrant, readGrant]), // bob, alice
            });
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            const rows = screen.getAllByRole('row').slice(1); // skip header
            expect(within(rows[0]).getByText('alice')).toBeInTheDocument();
            expect(within(rows[1]).getByText('bob')).toBeInTheDocument();
        });
    });

    describe('wildcard grants', () => {
        it('renders wildcard username as "* (everyone)"', async () => {
            const svc = mockSvc({ getDomainUserAccess: () => Promise.resolve([wildcardGrant]) });
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() =>
                expect(screen.getByText('* (everyone)')).toBeInTheDocument()
            );
        });
    });

    describe('revoking access', () => {
        it('calls revokeDomainAccess with correct args after confirmation', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^revoke$/i }));

            await waitFor(() =>
                expect(svc.revokeDomainAccess).toHaveBeenCalledWith('retail', readGrant.userAccessId)
            );
        });

        it('removes the revoked grant from the table', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^revoke$/i }));

            await waitFor(() =>
                expect(screen.queryByText('alice')).not.toBeInTheDocument()
            );
        });

        it('shows grant details in the confirmation dialog', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));

            const dialog = screen.getByRole('dialog');
            expect(within(dialog).getByText(/alice/)).toBeInTheDocument();
            expect(within(dialog).getByText(/read/)).toBeInTheDocument();
        });
    });

    describe('granting access', () => {
        it('calls grantDomainAccess and refreshes the list', async () => {
            const svc = mockSvc();
            render(<DomainAccessPanel domain="retail" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
                target: { value: 'carol' },
            });
            fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

            await waitFor(() =>
                expect(svc.grantDomainAccess).toHaveBeenCalledWith('retail', {
                    username: 'carol',
                    permission: 'read',
                })
            );
            expect(svc.getDomainUserAccess).toHaveBeenCalledTimes(2);
        });
    });
});
