import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentUserAccess } from './useCurrentUserAccess.js';
import { UserAccessService } from '../../service/user-access-service.js';
import { UserAccess } from '../../model/user-access.js';

const namespaceGrant = (namespace: string, permission: UserAccess['permission'], id = 1): UserAccess => ({
    userAccessId: id,
    username: 'alice',
    permission,
    namespace,
});

const globalAdminGrant: UserAccess = namespaceGrant('GLOBAL', 'admin', 99);
const wildcardReadGrant: UserAccess = { userAccessId: 50, username: '*', permission: 'read', namespace: 'finos' };

function mockService(resolvesWith: UserAccess[]): UserAccessService {
    const svc = new UserAccessService();
    vi.spyOn(svc, 'getCurrentUserAccess').mockResolvedValue(resolvesWith);
    return svc;
}

function rejectingService(): UserAccessService {
    const svc = new UserAccessService();
    vi.spyOn(svc, 'getCurrentUserAccess').mockRejectedValue(new Error('network error'));
    return svc;
}

beforeEach(() => vi.clearAllMocks());

describe('useCurrentUserAccess', () => {

    describe('loading state', () => {
        it('starts in loading state', () => {
            const svc = mockService([]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            expect(result.current.loading).toBe(true);
        });

        it('clears loading after grants resolve', async () => {
            const svc = mockService([namespaceGrant('finos', 'read')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.loading).toBe(false));
        });

        it('clears loading even when the service rejects', async () => {
            const svc = rejectingService();
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.loading).toBe(false));
        });
    });

    describe('grants', () => {
        it('returns grants from the service', async () => {
            const grants = [namespaceGrant('finos', 'read'), namespaceGrant('payments', 'write', 2)];
            const svc = mockService(grants);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.grants).toEqual(grants));
        });

        it('includes wildcard grants', async () => {
            const svc = mockService([wildcardReadGrant]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() =>
                expect(result.current.grants.some((g) => g.username === '*')).toBe(true)
            );
        });

        it('returns empty grants on error', async () => {
            const svc = rejectingService();
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.grants).toEqual([]));
        });
    });

    describe('error state', () => {
        it('has no error on success', async () => {
            const svc = mockService([]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.error).toBeNull());
        });

        it('sets an error message when the service rejects', async () => {
            const svc = rejectingService();
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.error).not.toBeNull());
        });
    });

    describe('isGlobalAdmin', () => {
        it('is false when user has no grants', async () => {
            const svc = mockService([]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.isGlobalAdmin).toBe(false));
        });

        it('is false when user has namespace admin but not GLOBAL', async () => {
            const svc = mockService([namespaceGrant('finos', 'admin')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.isGlobalAdmin).toBe(false));
        });

        it('is true when user has a GLOBAL admin grant', async () => {
            const svc = mockService([globalAdminGrant]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.isGlobalAdmin).toBe(true));
        });

        it('is false when GLOBAL grant has non-admin permission', async () => {
            const svc = mockService([namespaceGrant('GLOBAL', 'read')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.isGlobalAdmin).toBe(false));
        });
    });

    describe('canAdminNamespace', () => {
        it('returns false when user has no grants', async () => {
            const svc = mockService([]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.canAdminNamespace('finos')).toBe(false));
        });

        it('returns false when user has only read on the namespace', async () => {
            const svc = mockService([namespaceGrant('finos', 'read')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.canAdminNamespace('finos')).toBe(false));
        });

        it('returns true when user has admin on the specific namespace', async () => {
            const svc = mockService([namespaceGrant('finos', 'admin')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.canAdminNamespace('finos')).toBe(true));
        });

        it('returns false when user has admin on a different namespace', async () => {
            const svc = mockService([namespaceGrant('payments', 'admin')]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.canAdminNamespace('finos')).toBe(false));
        });

        it('returns true for any namespace when user is global admin', async () => {
            const svc = mockService([globalAdminGrant]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => {
                expect(result.current.canAdminNamespace('finos')).toBe(true);
                expect(result.current.canAdminNamespace('payments')).toBe(true);
                expect(result.current.canAdminNamespace('anything')).toBe(true);
            });
        });

        it('wildcard grants do not confer namespace admin', async () => {
            const svc = mockService([wildcardReadGrant]);
            const { result } = renderHook(() => useCurrentUserAccess(svc));
            await waitFor(() => expect(result.current.canAdminNamespace('finos')).toBe(false));
        });
    });
});
