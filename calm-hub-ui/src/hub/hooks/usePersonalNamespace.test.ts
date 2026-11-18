import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePersonalNamespace } from './usePersonalNamespace.js';

const fetchPersonalNamespace = vi.fn();
const createPersonalNamespace = vi.fn();

vi.mock('../../service/personal-namespace-service', () => ({
    PersonalNamespaceService: class {
        fetchPersonalNamespace = fetchPersonalNamespace;
        createPersonalNamespace = createPersonalNamespace;
    },
}));

describe('usePersonalNamespace', () => {
    beforeEach(() => {
        fetchPersonalNamespace.mockReset();
        createPersonalNamespace.mockReset();
    });

    it('starts loading, then holds the fetched state', async () => {
        fetchPersonalNamespace.mockResolvedValue({ status: 'available', name: 'users.alice' });
        const { result } = renderHook(() => usePersonalNamespace());

        expect(result.current.state).toEqual({ status: 'loading' });
        await waitFor(() => expect(result.current.state).toEqual({ status: 'available', name: 'users.alice' }));
    });

    it('treats a failed fetch as unavailable', async () => {
        fetchPersonalNamespace.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => usePersonalNamespace());

        await waitFor(() => expect(result.current.state).toEqual({ status: 'unavailable' }));
    });

    it('ignores a fetch that resolves after unmount', async () => {
        let resolve: (v: unknown) => void = () => {};
        fetchPersonalNamespace.mockReturnValue(new Promise((r) => (resolve = r)));
        const { result, unmount } = renderHook(() => usePersonalNamespace());
        unmount();
        resolve({ status: 'owned', name: 'users.alice' });

        await Promise.resolve();
        expect(result.current.state).toEqual({ status: 'loading' });
    });

    it('creates the namespace and reports ownership', async () => {
        fetchPersonalNamespace.mockResolvedValue({ status: 'available', name: 'users.alice' });
        createPersonalNamespace.mockResolvedValue({ status: 'owned', name: 'users.alice' });
        const { result } = renderHook(() => usePersonalNamespace());
        await waitFor(() => expect(result.current.state.status).toBe('available'));

        let created = false;
        await act(async () => {
            created = await result.current.create();
        });

        expect(created).toBe(true);
        expect(result.current.state).toEqual({ status: 'owned', name: 'users.alice' });
        expect(result.current.creating).toBe(false);
    });

    it('reports false when the name is taken', async () => {
        fetchPersonalNamespace.mockResolvedValue({ status: 'available', name: 'users.alice' });
        createPersonalNamespace.mockResolvedValue({ status: 'taken', name: 'users.alice' });
        const { result } = renderHook(() => usePersonalNamespace());
        await waitFor(() => expect(result.current.state.status).toBe('available'));

        let created = true;
        await act(async () => {
            created = await result.current.create();
        });

        expect(created).toBe(false);
        expect(result.current.state.status).toBe('taken');
    });

    it('flags a failed create and keeps the state', async () => {
        fetchPersonalNamespace.mockResolvedValue({ status: 'available', name: 'users.alice' });
        createPersonalNamespace.mockRejectedValue(new Error('boom'));
        const { result } = renderHook(() => usePersonalNamespace());
        await waitFor(() => expect(result.current.state.status).toBe('available'));

        await act(async () => {
            await result.current.create();
        });

        expect(result.current.createFailed).toBe(true);
        expect(result.current.state.status).toBe('available');
    });
});
