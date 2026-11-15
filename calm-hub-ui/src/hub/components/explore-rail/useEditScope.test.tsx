import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useEditScope } from './useEditScope.js';
import { UserAccessProvider, useUserAccess } from '../../../admin/context/UserAccessContext.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import type { UserAccess } from '../../../model/user-access.js';
import type { UserAccessService } from '../../../service/user-access-service.js';

const STORAGE_KEY = 'calmHub.editScope';

function wrapperFor(grants: UserAccess[]) {
    const service = { getCurrentUserAccess: () => Promise.resolve(grants) } as unknown as UserAccessService;
    return ({ children }: { children: ReactNode }) => <UserAccessProvider service={service}>{children}</UserAccessProvider>;
}

const write = (namespace: string): UserAccess => ({ userAccessId: 0, username: 'alice', permission: 'write', namespace });

describe('useEditScope', () => {
    it('hides the control while access is loading', () => {
        const { result } = renderHook(() => useEditScope(createMemoryStorage()));
        expect(result.current.showScopeControl).toBe(false);
        expect(result.current.canEditNamespace).toBeUndefined();
    });

    it('hides the control for a user with no grants', async () => {
        const { result } = renderHook(() => ({ scope: useEditScope(createMemoryStorage()), access: useUserAccess() }), {
            wrapper: wrapperFor([]),
        });
        await waitFor(() => expect(result.current.access.loading).toBe(false));
        expect(result.current.scope.showScopeControl).toBe(false);
    });

    it('hides the control for a global admin, as with auth off', async () => {
        const globalAdmin: UserAccess = { userAccessId: 0, username: 'alice', permission: 'admin', namespace: 'GLOBAL' };
        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, 'editable');
        const { result } = renderHook(() => ({ scope: useEditScope(storage), access: useUserAccess() }), {
            wrapper: wrapperFor([globalAdmin, write('a.c')]),
        });
        await waitFor(() => expect(result.current.access.loading).toBe(false));
        expect(result.current.scope.showScopeControl).toBe(false);
        expect(result.current.scope.editableOnly).toBe(false);
    });

    it('filters only after the user selects Can edit', async () => {
        const { result } = renderHook(() => useEditScope(createMemoryStorage()), { wrapper: wrapperFor([write('a.c')]) });
        await waitFor(() => expect(result.current.showScopeControl).toBe(true));
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
        const { result } = renderHook(() => useEditScope(createMemoryStorage()), { wrapper: wrapperFor([domainWrite]) });
        await waitFor(() => expect(result.current.showScopeControl).toBe(true));
        const domains = ['compliance', 'security'];
        expect(result.current.filterDomains(domains, (d) => d)).toEqual(domains);

        act(() => result.current.setScope('editable'));

        expect(result.current.filterDomains(domains, (d) => d)).toEqual(['security']);
    });

    it('writes the choice to storage and reads it back', async () => {
        const storage = createMemoryStorage();
        const first = renderHook(() => useEditScope(storage), { wrapper: wrapperFor([write('a.c')]) });
        act(() => first.result.current.setScope('editable'));
        expect(storage.getItem(STORAGE_KEY)).toBe('editable');
        first.unmount();

        const second = renderHook(() => useEditScope(storage), { wrapper: wrapperFor([write('a.c')]) });
        expect(second.result.current.scope).toBe('editable');
    });

    it('falls back to All for an unknown stored value', () => {
        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, 'something-else');
        const { result } = renderHook(() => useEditScope(storage));
        expect(result.current.scope).toBe('all');
    });

    it('works when storage throws', () => {
        const throwingStorage = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('blocked');
            },
        } as unknown as Storage;
        const { result } = renderHook(() => useEditScope(throwingStorage));
        expect(result.current.scope).toBe('all');
        act(() => result.current.setScope('editable'));
        expect(result.current.scope).toBe('editable');
    });
});
