import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Data } from '../../../../model/calm.js';
import type { Decorator } from '../../../../visualizer/contracts/contracts.js';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { CalmService } from '../../../../service/calm-service.js';
import { useArchitectureDecorators } from './useArchitectureDecorators.js';

const TARGET = '/api/calm/namespaces/my-namespace/architectures/42/versions/1-0-0';
const architecture: Data = { name: 'my-namespace', calmType: 'Architectures', id: 'my-arch', version: '1.0.0', data: {} };
const decorator = (uniqueId: string) => ({ uniqueId, type: 'deployment', target: [], appliesTo: ['n1'], data: {} }) as unknown as Decorator;

/** jsdom's document is always visible; tests override the getter to simulate a background tab. */
function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('useArchitectureDecorators', () => {
    const resolve = vi.fn();
    const fetch = vi.fn();
    const service = { resolveArchitectureVersionTarget: resolve, fetchDecoratorsForTarget: fetch } as unknown as CalmService;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    /** Lets pending fetch promises settle and React commit, under fake timers. */
    const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    const renderFor = (data: Data, isArchitecture = true, active = true) =>
        renderHook(({ d, a, on }) => useArchitectureDecorators(service, d, a, on), { initialProps: { d: data, a: isArchitecture, on: active } });

    beforeEach(() => {
        vi.useFakeTimers();
        resolve.mockReset();
        resolve.mockImplementation((_ns: string, _id: string, version: string) =>
            Promise.resolve(TARGET.replace('1-0-0', version.replace(/\./g, '-'))));
        fetch.mockReset();
        fetch.mockResolvedValue([]);
        setVisibility('visible');
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        errorSpy.mockRestore();
        setVisibility('visible');
    });

    it('fetches every type for the version, and again every 5 seconds', async () => {
        fetch.mockResolvedValue([decorator('d1')]);
        const { result } = renderFor(architecture);
        expect(result.current).toEqual({ status: 'loading' });
        await flush();

        expect(resolve).toHaveBeenCalledWith('my-namespace', 'my-arch', '1.0.0');
        expect(fetch).toHaveBeenCalledWith('my-namespace', TARGET);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });

        fetch.mockResolvedValue([decorator('d1'), decorator('d2')]);
        await advance(5000);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1'), decorator('d2')] });
    });

    it('stops refreshing once unmounted', async () => {
        const { unmount } = renderFor(architecture);
        await flush();
        unmount();
        fetch.mockClear();
        await advance(15000);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('returns no decorators and makes no request for a pattern', async () => {
        const { result } = renderFor({ ...architecture, calmType: 'Patterns' }, false);
        await advance(5000);
        expect(fetch).not.toHaveBeenCalled();
        expect(result.current).toEqual({ status: 'loaded', decorators: [] });
    });

    it('keeps the same state when a refresh returns the same list', async () => {
        fetch.mockImplementation(() => Promise.resolve([decorator('d1')]));
        const { result } = renderFor(architecture);
        await flush();
        const first = result.current;
        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.current).toBe(first);
    });

    it('shows loading, not the previous version\'s list, as soon as another version is opened', async () => {
        fetch.mockResolvedValue([decorator('d1')]);
        const { result, rerender } = renderFor(architecture);
        await flush();

        fetch.mockImplementation(() => new Promise(() => {}));
        rerender({ d: { ...architecture, version: '2.0.0' }, a: true, on: true });
        await flush();

        expect(fetch).toHaveBeenLastCalledWith('my-namespace', TARGET.replace('1-0-0', '2-0-0'));
        expect(result.current).toEqual({ status: 'loading' });
    });

    it('keeps a newer refresh\'s result when an older, slower one lands after it', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        fetch
            .mockImplementationOnce(() => new Promise((done) => { resolveFirst = done; }))
            .mockImplementationOnce(() => Promise.resolve([decorator('new')]));
        const { result } = renderFor(architecture);
        await flush();
        await advance(5000);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('new')] });

        await act(async () => { resolveFirst([decorator('old')]); });
        await flush();

        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('new')] });
    });

    it('resolves a slug to its version target once, not on every refresh', async () => {
        renderFor(architecture);
        await flush();
        await advance(15000);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('fails when the first request fails, and loads on a later refresh', async () => {
        fetch.mockRejectedValueOnce(new Error('hub down')).mockResolvedValue([decorator('d1')]);
        const { result } = renderFor(architecture);
        await flush();
        expect(result.current).toEqual({ status: 'error', reason: 'unavailable' });

        await advance(5000);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });
    });

    it('fails when the slug cannot be resolved, and tries to resolve it again', async () => {
        resolve.mockResolvedValueOnce(undefined);
        const { result } = renderFor(architecture);
        await flush();
        expect(result.current).toEqual({ status: 'error', reason: 'unmapped' });
        expect(fetch).not.toHaveBeenCalled();

        await advance(5000);
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual({ status: 'loaded', decorators: [] });
    });

    it('shows the error state, not an empty list, when the slug lookup fails before anything loaded', async () => {
        resolve.mockRejectedValueOnce(new Error('mappings 500'));
        const { result } = renderFor(architecture);
        await flush();
        expect(result.current).toEqual({ status: 'error', reason: 'unavailable' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not keep a failed slug lookup, and looks it up again on the next refresh', async () => {
        resolve.mockRejectedValueOnce(new Error('mappings 500'));
        fetch.mockResolvedValue([decorator('d1')]);
        const { result } = renderFor(architecture);
        await flush();

        await advance(5000);
        expect(resolve).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });

        await advance(5000);
        expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('keeps telling an unmapped slug from a failed lookup on later refreshes', async () => {
        resolve.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('mappings 500')).mockResolvedValueOnce(undefined);
        const { result } = renderFor(architecture);
        await flush();
        expect(result.current).toEqual({ status: 'error', reason: 'unmapped' });
        await advance(5000);
        expect(result.current).toEqual({ status: 'error', reason: 'unavailable' });
        await advance(5000);
        expect(result.current).toEqual({ status: 'error', reason: 'unmapped' });
    });

    it('logs an unreachable mappings API once, however often the lookup is retried', async () => {
        const ax = axios.create();
        const mock = new AxiosMockAdapter(ax);
        mock.onGet('/calm/namespaces/my-namespace/architectures').reply(500);
        const real = new CalmService(ax);
        const { result } = renderHook(() => useArchitectureDecorators(real, architecture, true));
        await flush();
        await advance(10000);
        await advance(30000);

        expect(mock.history.get.length).toBeGreaterThanOrEqual(4);
        expect(result.current).toEqual({ status: 'error', reason: 'unavailable' });
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps the last list when a refresh fails', async () => {
        fetch.mockResolvedValueOnce([decorator('d1')]).mockRejectedValue(new Error('hub down'));
        const { result } = renderFor(architecture);
        await flush();
        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });
    });

    it('makes no call while the tab is hidden, and loads once when it becomes visible', async () => {
        setVisibility('hidden');
        renderFor(architecture);
        await flush();
        await advance(15000);
        expect(fetch).not.toHaveBeenCalled();

        setVisibility('visible');
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('makes no call while inactive, loads at once when it becomes active, and then polls', async () => {
        fetch.mockResolvedValue([decorator('d1')]);
        const { result, rerender } = renderFor(architecture, true, false);
        await flush();
        await advance(15000);
        expect(fetch).not.toHaveBeenCalled();
        expect(result.current).toEqual({ status: 'loading' });

        rerender({ d: architecture, a: true, on: true });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });

        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('stops polling when it becomes inactive, keeps the last list, and keeps the resolved slug', async () => {
        fetch.mockResolvedValue([decorator('d1')]);
        const { result, rerender } = renderFor(architecture);
        await flush();
        rerender({ d: architecture, a: true, on: false });
        await advance(15000);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });

        rerender({ d: architecture, a: true, on: true });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('keeps the backoff while inactive, and does not load at once when it becomes active during the backoff', async () => {
        fetch.mockRejectedValue(new Error('hub down'));
        const { rerender } = renderFor(architecture);
        await flush();
        await advance(10000);
        expect(fetch).toHaveBeenCalledTimes(3);

        rerender({ d: architecture, a: true, on: false });
        rerender({ d: architecture, a: true, on: true });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(3);
        await advance(25000);
        expect(fetch).toHaveBeenCalledTimes(3);
        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('does not load at once when the browser tab becomes visible during the backoff', async () => {
        fetch.mockRejectedValue(new Error('hub down'));
        renderFor(architecture);
        await flush();
        await advance(10000);
        expect(fetch).toHaveBeenCalledTimes(3);

        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('loads at once when it becomes active after the backoff ran out while inactive', async () => {
        fetch.mockRejectedValue(new Error('hub down'));
        const { rerender } = renderFor(architecture);
        await flush();
        await advance(10000);
        rerender({ d: architecture, a: true, on: false });
        await advance(60000);
        expect(fetch).toHaveBeenCalledTimes(3);

        rerender({ d: architecture, a: true, on: true });
        await flush();
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('stops listening for visibility changes once unmounted', async () => {
        const { unmount } = renderFor(architecture);
        await flush();
        unmount();
        fetch.mockClear();
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('backs off to 30 seconds after three failures in a row, logging once, until a refresh succeeds', async () => {
        fetch.mockRejectedValue(new Error('hub down'));
        const { result } = renderFor(architecture);
        await flush();
        await advance(10000);
        expect(fetch).toHaveBeenCalledTimes(3);

        await advance(25000);
        expect(fetch).toHaveBeenCalledTimes(3);

        fetch.mockResolvedValue([decorator('d1')]);
        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(result.current).toEqual({ status: 'loaded', decorators: [decorator('d1')] });

        await advance(5000);
        expect(fetch).toHaveBeenCalledTimes(5);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });
});
