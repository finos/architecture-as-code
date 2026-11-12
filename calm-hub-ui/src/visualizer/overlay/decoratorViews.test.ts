import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, it, expect, vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import manifest from '../../../../calm-hub/src/test/resources/extensions-test/operator/scanner/extension.json' with { type: 'json' };
import { overlayByElement } from './overlayEngine.js';
import type { OverlayDecoratorView } from '../contracts/contracts.js';
import { useDecoratorViews } from './decoratorViews.js';
import { BUILTIN_DECORATOR_VIEWS } from './builtinDecoratorViews.js';
import { ExtensionService } from '../../service/extension-service.js';
import { ExtensionsProvider, REGISTRY_RETRY_MS } from '../../extensions/ExtensionsContext.js';

vi.mock('../../authService.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({}) }));

let fetchViews: Mock;
beforeEach(() => {
    fetchViews = vi.spyOn(ExtensionService.prototype, 'fetchDecoratorViews') as unknown as Mock;
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function withProvider(failures: number) {
    const ax = axios.create();
    const mock = new AxiosMockAdapter(ax as never);
    for (let n = 0; n < failures; n++) mock.onGet('/api/calm/extensions').replyOnce(503);
    mock.onGet('/api/calm/extensions').reply(200, { values: [{
        id: 'scanner', name: 'Scanner', hubApi: 0, routes: [],
        contributes: { 'decorator-views': [{ id: 'scan', match: { type: 'scan' }, label: 'Scan' }] },
    }] });
    const service = new ExtensionService(ax);
    return ({ children }: { children: ReactNode }) => createElement(ExtensionsProvider, { service, children });
}

it('loads a new decorator type without a UI mapping', async () => {
    const views = manifest.contributes['decorator-views'] as OverlayDecoratorView[];
    fetchViews.mockResolvedValue(views);
    const { result } = renderHook(useDecoratorViews);
    await waitFor(() => expect(result.current).toEqual(views));
    const overlay = overlayByElement(result.current[0] as OverlayDecoratorView, [{
        uniqueId: 'scan-1', type: 'security-scan', target: ['architecture'],
        appliesTo: ['service'], data: { result: 'unsafe' },
    }]);
    expect(overlay.get('service')?.status).toBe('error');
});

it('falls back to the built-in views when the registry fails', async () => {
    fetchViews.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(useDecoratorViews);
    await waitFor(() => expect(result.current).toBe(BUILTIN_DECORATOR_VIEWS));
});

it('shows only the registered views when the registry loads, even with no built-in views', async () => {
    fetchViews.mockResolvedValue([]);
    const { result } = renderHook(useDecoratorViews);
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toEqual([]);
});

it('ignores a registry response after unmount', async () => {
    let resolve!: (views: never[]) => void;
    fetchViews.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(useDecoratorViews);
    unmount();
    resolve([]);
});

it('shows the extension views when the provider loads the registry after a failure', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useDecoratorViews, { wrapper: withProvider(1) });
    await act(async () => {});
    expect(result.current).toBe(BUILTIN_DECORATOR_VIEWS);
    await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
    await act(async () => {});
    expect(result.current.map((view) => view.id)).toEqual(['scan']);
});

it('keeps the built-in views while the registry still fails', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(useDecoratorViews, { wrapper: withProvider(3) });
    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
    await act(async () => {});
    expect(result.current).toBe(BUILTIN_DECORATOR_VIEWS);
});
