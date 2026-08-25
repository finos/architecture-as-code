import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMigrationError } from './use-migration-store.js';
import { migrationStore } from './migration-store.js';

describe('useMigrationError', () => {
    beforeEach(() => {
        migrationStore.setMigrationError(null);
    });

    it('returns the current store message on initial render', () => {
        migrationStore.setMigrationError('migrating');
        const { result } = renderHook(() => useMigrationError());
        expect(result.current).toBe('migrating');
    });

    it('updates when the store emits a new message', () => {
        const { result } = renderHook(() => useMigrationError());
        expect(result.current).toBeNull();

        act(() => {
            migrationStore.setMigrationError('migrating');
        });

        expect(result.current).toBe('migrating');
    });

    it('unsubscribes from the store on unmount', () => {
        const unsubscribe = vi.fn();
        const subscribeSpy = vi.spyOn(migrationStore, 'subscribe').mockReturnValue(unsubscribe);

        const { unmount } = renderHook(() => useMigrationError());
        expect(unsubscribe).not.toHaveBeenCalled();

        unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        subscribeSpy.mockRestore();
    });
});
