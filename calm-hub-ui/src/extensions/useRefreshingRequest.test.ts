import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRefreshingRequest } from './useRefreshingRequest.js';

function deferred() {
    const calls: { resolve: (value: string) => void; reject: (error: Error) => void; signal: AbortSignal }[] = [];
    const load = vi.fn(
        (signal: AbortSignal) =>
            new Promise<string>((resolve, reject) => {
                calls.push({ resolve, reject, signal });
            })
    );
    return { calls, load };
}

describe('useRefreshingRequest', () => {
    it('never shows a value under a view that it was not loaded for', async () => {
        const { calls, load } = deferred();
        const { result, rerender } = renderHook(({ view }) => useRefreshingRequest(view, 0, load), { initialProps: { view: 'node-a' } });
        await act(async () => calls[0].resolve('data of node-a'));
        expect(result.current.value).toBe('data of node-a');
        expect(calls[0].signal.aborted).toBe(false);

        rerender({ view: 'node-b' });
        expect(result.current).toMatchObject({ value: undefined, loading: true });
        // A load function that did not change does not load again: the new view is in the request key.
        expect(load).toHaveBeenCalledTimes(2);
        await act(async () => calls[1].resolve('data of node-b'));
        expect(result.current.value).toBe('data of node-b');
    });

    it('keeps the value while the revision loads again, and drops a late reply of an earlier request', async () => {
        const { calls, load } = deferred();
        const { result, rerender } = renderHook(({ revision }) => useRefreshingRequest('view', revision, load), {
            initialProps: { revision: 0 },
        });
        await act(async () => calls[0].resolve('first'));
        rerender({ revision: 1 });
        expect(result.current).toMatchObject({ value: 'first', loading: true });
        rerender({ revision: 2 });
        expect(calls[1].signal.aborted).toBe(true);
        await act(async () => calls[2].resolve('third'));
        await act(async () => calls[1].resolve('second'));
        expect(result.current).toMatchObject({ value: 'third', loading: false });
    });

    it('does not load while there is no load function, or again for a request that is done', async () => {
        const { calls, load } = deferred();
        const { result, rerender } = renderHook(({ active }) => useRefreshingRequest('view', 0, active ? load : undefined), {
            initialProps: { active: false },
        });
        expect(result.current.loading).toBe(false);
        expect(load).not.toHaveBeenCalled();
        rerender({ active: true });
        await act(async () => calls[0].reject(new Error('down')));
        expect(result.current).toMatchObject({ failed: true, loading: false });
        rerender({ active: false });
        rerender({ active: true });
        expect(load).toHaveBeenCalledOnce();

        act(() => result.current.retry());
        expect(result.current).toMatchObject({ retrying: true, failed: false });
        await act(async () => calls[1].resolve('back'));
        expect(result.current).toMatchObject({ value: 'back', retrying: false, failed: false });
    });

    it('does not report a later request as a retry after a retry succeeded', async () => {
        const { calls, load } = deferred();
        const { result, rerender } = renderHook(({ revision }) => useRefreshingRequest('view', revision, load), {
            initialProps: { revision: 0 },
        });
        await act(async () => calls[0].reject(new Error('down')));
        act(() => result.current.retry());
        await act(async () => calls[1].resolve('back'));

        rerender({ revision: 1 });
        expect(result.current).toMatchObject({ value: 'back', loading: true, failed: false, retrying: false });
    });
});
