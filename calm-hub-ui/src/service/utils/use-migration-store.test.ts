import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
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

    it('stops updating after unmount', () => {
        const { result, unmount } = renderHook(() => useMigrationError());
        unmount();

        act(() => {
            migrationStore.setMigrationError('migrating');
        });

        expect(result.current).toBeNull();
    });
});
