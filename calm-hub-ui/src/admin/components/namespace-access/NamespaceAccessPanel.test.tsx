import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NamespaceAccessPanel } from './NamespaceAccessPanel.js';
import { UserAccessService } from '../../../service/user-access-service.js';
import { UserAccess } from '../../../model/user-access.js';

const readGrant: UserAccess = { userAccessId: 1, username: 'alice', permission: 'read', namespace: 'finos' };
const adminGrant: UserAccess = { userAccessId: 2, username: 'bob', permission: 'admin', namespace: 'finos' };
const wildcardGrant: UserAccess = { userAccessId: 3, username: '*', permission: 'read', namespace: 'finos' };

function mockSvc(overrides: Partial<Record<keyof UserAccessService, unknown>> = {}): UserAccessService {
    const svc = new UserAccessService();
    vi.spyOn(svc, 'getNamespaceUserAccess').mockResolvedValue([readGrant, adminGrant]);
    vi.spyOn(svc, 'grantNamespaceAccess').mockResolvedValue({ ...readGrant, userAccessId: 99 });
    vi.spyOn(svc, 'revokeNamespaceAccess').mockResolvedValue(undefined);
    Object.entries(overrides).forEach(([k, v]) => {
        vi.spyOn(svc, k as keyof UserAccessService).mockImplementation(v as never);
    });
    return svc;
}

beforeEach(() => vi.clearAllMocks());

describe('NamespaceAccessPanel', () => {

    describe('loading and fetching', () => {
        it('shows a loading spinner initially', () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            expect(screen.getByLabelText('Loading grants')).toBeInTheDocument();
        });

        it('renders grant rows after loading', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
            expect(screen.getByText('bob')).toBeInTheDocument();
        });

        it('shows empty state when no grants exist', async () => {
            const svc = mockSvc({ getNamespaceUserAccess: () => Promise.resolve([]) });
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() =>
                expect(screen.getByText(/no access grants/i)).toBeInTheDocument()
            );
        });

        it('shows an error message when fetch fails', async () => {
            const svc = mockSvc({ getNamespaceUserAccess: () => Promise.reject(new Error('fail')) });
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i)
            );
        });

        it('displays the namespace name', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => expect(screen.getByText('finos')).toBeInTheDocument());
        });
    });

    describe('wildcard grants', () => {
        it('renders wildcard username as "* (everyone)"', async () => {
            const svc = mockSvc({ getNamespaceUserAccess: () => Promise.resolve([wildcardGrant]) });
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() =>
                expect(screen.getByText('* (everyone)')).toBeInTheDocument()
            );
        });
    });

    describe('revoking access', () => {
        it('calls revokeNamespaceAccess with correct args after confirmation', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^revoke$/i }));

            await waitFor(() =>
                expect(svc.revokeNamespaceAccess).toHaveBeenCalledWith('finos', readGrant.userAccessId)
            );
        });

        it('removes the revoked grant from the table', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^revoke$/i }));

            await waitFor(() =>
                expect(screen.queryByText('alice')).not.toBeInTheDocument()
            );
        });

        it('shows grant details in the confirmation dialog', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));

            const dialog = screen.getByRole('dialog');
            expect(within(dialog).getByText(/alice/)).toBeInTheDocument();
            expect(within(dialog).getByText(/read/)).toBeInTheDocument();
        });
    });

    describe('granting access', () => {
        it('calls grantNamespaceAccess and refreshes the list', async () => {
            const svc = mockSvc();
            render(<NamespaceAccessPanel namespace="finos" service={svc} />);
            await waitFor(() => screen.getByText('alice'));

            fireEvent.change(screen.getByRole('textbox', { name: /username/i }), {
                target: { value: 'carol' },
            });
            fireEvent.click(screen.getByRole('button', { name: /grant access/i }));

            await waitFor(() =>
                expect(svc.grantNamespaceAccess).toHaveBeenCalledWith('finos', {
                    username: 'carol',
                    permission: 'read',
                })
            );
            expect(svc.getNamespaceUserAccess).toHaveBeenCalledTimes(2);
        });
    });
});
