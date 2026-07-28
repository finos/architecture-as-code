import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthError } from './use-auth-store.js';
import { authStore } from './auth-store.js';

describe('useAuthError', () => {
    beforeEach(() => {
        authStore.setAuthError(null);
    });

    it('returns the current store status on initial render', () => {
        authStore.setAuthError(401);
        const { result } = renderHook(() => useAuthError());
        expect(result.current).toBe(401);
    });

    it('updates when the store emits a new status', () => {
        const { result } = renderHook(() => useAuthError());
        expect(result.current).toBeNull();

        act(() => {
            authStore.setAuthError(403);
        });

        expect(result.current).toBe(403);
    });

    it('unsubscribes from the store on unmount', () => {
        const unsubscribe = vi.fn();
        const subscribeSpy = vi.spyOn(authStore, 'subscribe').mockReturnValue(unsubscribe);

        const { unmount } = renderHook(() => useAuthError());
        expect(unsubscribe).not.toHaveBeenCalled();

        unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        subscribeSpy.mockRestore();
    });
});
