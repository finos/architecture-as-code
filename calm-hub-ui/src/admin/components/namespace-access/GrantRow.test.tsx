import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GrantRow } from './GrantRow.js';
import { UserAccess } from '../../../model/user-access.js';

const namedGrant: UserAccess = { userAccessId: 1, username: 'alice', permission: 'read', namespace: 'finos' };
const wildcardGrant: UserAccess = { userAccessId: 2, username: '*', permission: 'read', namespace: 'finos' };
const adminGrant: UserAccess = { userAccessId: 3, username: 'bob', permission: 'admin', namespace: 'finos' };

describe('GrantRow', () => {
    it('renders the username', () => {
        render(<table><tbody><GrantRow grant={namedGrant} onRequestRevoke={() => {}} /></tbody></table>);
        expect(screen.getByText('alice')).toBeInTheDocument();
    });

    it('renders wildcard username as "* (everyone)"', () => {
        render(<table><tbody><GrantRow grant={wildcardGrant} onRequestRevoke={() => {}} /></tbody></table>);
        expect(screen.getByText('* (everyone)')).toBeInTheDocument();
    });

    it('renders the permission badge', () => {
        render(<table><tbody><GrantRow grant={namedGrant} onRequestRevoke={() => {}} /></tbody></table>);
        expect(screen.getByText('read')).toBeInTheDocument();
    });

    it('applies correct badge class for admin permission', () => {
        render(<table><tbody><GrantRow grant={adminGrant} onRequestRevoke={() => {}} /></tbody></table>);
        const badge = screen.getByText('admin');
        expect(badge.className).toContain('badge-error');
    });

    it('calls onRequestRevoke with the grant when Revoke is clicked', () => {
        const onRequestRevoke = vi.fn();
        render(<table><tbody><GrantRow grant={namedGrant} onRequestRevoke={onRequestRevoke} /></tbody></table>);
        fireEvent.click(screen.getByRole('button', { name: /revoke access for alice/i }));
        expect(onRequestRevoke).toHaveBeenCalledWith(namedGrant);
    });

    it('uses wildcard display name in aria-label', () => {
        render(<table><tbody><GrantRow grant={wildcardGrant} onRequestRevoke={() => {}} /></tbody></table>);
        expect(screen.getByRole('button', { name: /revoke access for \* \(everyone\)/i })).toBeInTheDocument();
    });
});
