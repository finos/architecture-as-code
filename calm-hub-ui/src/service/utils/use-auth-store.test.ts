import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
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

    it('stops updating after unmount', () => {
        const { result, unmount } = renderHook(() => useAuthError());
        unmount();

        act(() => {
            authStore.setAuthError(401);
        });

        expect(result.current).toBeNull();
    });
});
