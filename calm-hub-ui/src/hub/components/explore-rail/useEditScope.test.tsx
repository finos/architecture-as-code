import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useEditScope } from './useEditScope.js';
import { UserAccessProvider, useUserAccess } from '../../../admin/context/UserAccessContext.js';
import type { UserAccess } from '../../../model/user-access.js';
import type { UserAccessService } from '../../../service/user-access-service.js';

function wrapperFor(grants: UserAccess[]) {
    const service = { getCurrentUserAccess: () => Promise.resolve(grants) } as unknown as UserAccessService;
    return ({ children }: { children: ReactNode }) => <UserAccessProvider service={service}>{children}</UserAccessProvider>;
}

const write = (namespace: string): UserAccess => ({ userAccessId: 0, username: 'alice', permission: 'write', namespace });

describe('useEditScope', () => {
    it('hides the toggle while access is loading', () => {
        const { result } = renderHook(() => useEditScope());
        expect(result.current.showScopeToggle).toBe(false);
        expect(result.current.canEditNamespace).toBeUndefined();
    });

    it('hides the toggle for a user with no grants', async () => {
        const { result } = renderHook(() => useEditScope(), { wrapper: wrapperFor([]) });
        await waitFor(() => expect(result.current.showScopeToggle).toBe(false));
    });

    it('hides the toggle for a global admin, as with auth off', async () => {
        const globalAdmin: UserAccess = { userAccessId: 0, username: 'alice', permission: 'admin', namespace: 'GLOBAL' };
        const { result } = renderHook(() => ({ scope: useEditScope(), access: useUserAccess() }), {
            wrapper: wrapperFor([globalAdmin, write('a.c')]),
        });
        await waitFor(() => expect(result.current.access.loading).toBe(false));
        expect(result.current.scope.showScopeToggle).toBe(false);
        act(() => result.current.scope.setScope('editable'));
        expect(result.current.scope.editableOnly).toBe(false);
    });

    it('filters only after the user selects Can edit', async () => {
        const { result } = renderHook(() => useEditScope(), { wrapper: wrapperFor([write('a.c')]) });
        await waitFor(() => expect(result.current.showScopeToggle).toBe(true));
        expect(result.current.canEditNamespace).toBeUndefined();
        expect(result.current.isContextOnly('a')).toBe(false);

        act(() => result.current.setScope('editable'));

        expect(result.current.editableOnly).toBe(true);
        expect(result.current.canEditNamespace?.('a.c')).toBe(true);
        expect(result.current.isContextOnly('a')).toBe(true);
        expect(result.current.isContextOnly('a.c')).toBe(false);
    });

    it('filters domains only after the user selects Can edit', async () => {
        const domainWrite: UserAccess = { userAccessId: 1, username: 'alice', permission: 'write', domain: 'security' };
        const { result } = renderHook(() => useEditScope(), { wrapper: wrapperFor([domainWrite]) });
        await waitFor(() => expect(result.current.showScopeToggle).toBe(true));
        const domains = ['compliance', 'security'];
        expect(result.current.filterDomains(domains, (d) => d)).toEqual(domains);

        act(() => result.current.setScope('editable'));

        expect(result.current.filterDomains(domains, (d) => d)).toEqual(['security']);
    });
});
