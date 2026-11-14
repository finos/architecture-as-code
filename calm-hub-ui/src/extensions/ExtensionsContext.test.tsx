import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ExtensionsProvider,
    REGISTRY_RETRY_MS,
    useExtensions,
    useExtensionService,
    useExtensionsStatus,
} from './ExtensionsContext.js';
import { ExtensionRegistryError, ExtensionService } from '../service/extension-service.js';
import { authStore } from '../service/utils/auth-store.js';

vi.mock('../authService.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({}) }));

function Consumer() {
    return (
        <div>
            <span data-testid="status">{useExtensionsStatus()}</span>
            {useExtensions()
                .map((item) => item.name)
                .join(',') || 'empty'}
        </div>
    );
}

const registry = (values: unknown[]) => ({ values });
const entry = (id: string, hubApi = 0) => ({ id, name: id, hubApi, routes: [], contributes: {} });

function mockedService() {
    const ax = axios.create();
    return { service: new ExtensionService(ax), mock: new AxiosMockAdapter(ax as never) };
}

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    authStore.setAuthError(null);
});

describe('ExtensionsProvider', () => {
    it('sends one registry request when StrictMode replays effects, and skips unsupported contracts', async () => {
        const { service, mock } = mockedService();
        mock.onGet('/api/calm/extensions').reply(200, registry([entry('Test'), entry('Future', 1)]));
        render(
            <StrictMode>
                <ExtensionsProvider service={service}>
                    <Consumer />
                </ExtensionsProvider>
            </StrictMode>
        );
        expect(await screen.findByText('Test')).toBeInTheDocument();
        expect(screen.getByTestId('status')).toHaveTextContent('loaded');
        expect(mock.history.get).toHaveLength(1);
        expect(screen.queryByText(/Future/)).not.toBeInTheDocument();
    });

    it('keeps the UI unchanged on a registry error', async () => {
        const service = new ExtensionService();
        vi.spyOn(service, 'fetchExtensions').mockRejectedValue(new Error());
        render(
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        expect(await screen.findByText('empty')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
    });

    it('tries again with a growing delay after a failure, and loads when the registry comes back', async () => {
        vi.useFakeTimers();
        const service = new ExtensionService();
        const fetch = vi
            .spyOn(service, 'fetchExtensions')
            .mockRejectedValueOnce(new Error('502'))
            .mockRejectedValueOnce(new Error('502'))
            .mockResolvedValue([entry('Back')]);
        render(
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        await act(async () => {});
        expect(screen.getByTestId('status')).toHaveTextContent('failed');
        expect(fetch).toHaveBeenCalledTimes(1);

        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
        expect(fetch).toHaveBeenCalledTimes(2);
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
        expect(fetch).toHaveBeenCalledTimes(2);
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(screen.getByText('Back')).toBeInTheDocument();
        expect(screen.getByTestId('status')).toHaveTextContent('loaded');
    });

    it('stops its retry when it unmounts', async () => {
        vi.useFakeTimers();
        const service = new ExtensionService();
        const fetch = vi.spyOn(service, 'fetchExtensions').mockRejectedValue(new Error('502'));
        const { unmount } = render(
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        await act(async () => {});
        unmount();
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS * 10));
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('opens the sign-in prompt on a registry 401, and does not try again', async () => {
        vi.useFakeTimers();
        const { service, mock } = mockedService();
        mock.onGet('/api/calm/extensions').reply(401);
        render(
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        await act(async () => {});
        await act(async () => {});
        expect(screen.getByTestId('status')).toHaveTextContent('signed-out');
        expect(authStore.getAuthError()).toBe(401);
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS * 20));
        expect(mock.history.get).toHaveLength(1);
    });

    it('is loading until the registry settles', () => {
        const service = new ExtensionService();
        vi.spyOn(service, 'fetchExtensions').mockReturnValue(new Promise(() => {}));
        render(
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        expect(screen.getByTestId('status')).toHaveTextContent('loading');
    });

    it('starts the backoff again for a new service', async () => {
        vi.useFakeTimers();
        const failing = (service: ExtensionService) => vi.spyOn(service, 'fetchExtensions').mockRejectedValue(new Error('502'));
        const first = new ExtensionService();
        failing(first);
        const second = new ExtensionService();
        const fetchSecond = failing(second);
        const page = (service: ExtensionService) => (
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        const { rerender } = render(page(first));
        await act(async () => {});
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS * 2));

        rerender(page(second));
        await act(async () => {});
        expect(fetchSecond).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(REGISTRY_RETRY_MS));
        expect(fetchSecond).toHaveBeenCalledTimes(2);
    });

    it('goes back to loading, without the old list, when the service changes', async () => {
        const first = new ExtensionService();
        vi.spyOn(first, 'fetchExtensions').mockResolvedValue([entry('Old')]);
        const second = new ExtensionService();
        let complete: (values: ReturnType<typeof entry>[]) => void = () => {};
        vi.spyOn(second, 'fetchExtensions').mockReturnValue(new Promise((resolve) => (complete = resolve)));
        const page = (service: ExtensionService) => (
            <ExtensionsProvider service={service}>
                <Consumer />
            </ExtensionsProvider>
        );
        const { rerender } = render(page(first));
        expect(await screen.findByText('Old')).toBeInTheDocument();

        rerender(page(second));
        expect(screen.getByTestId('status')).toHaveTextContent('loading');
        expect(screen.getByText('empty')).toBeInTheDocument();

        await act(async () => complete([entry('New')]));
        expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('sends one registry request with the default service', async () => {
        const ax = axios.create();
        vi.spyOn(axios, 'create').mockReturnValue(ax);
        const mock = new AxiosMockAdapter(ax as never);
        mock.onGet('/api/calm/extensions').reply(200, registry([entry('Default')]));
        render(
            <StrictMode>
                <ExtensionsProvider>
                    <Consumer />
                </ExtensionsProvider>
            </StrictMode>
        );
        expect(await screen.findByText('Default')).toBeInTheDocument();
        expect(mock.history.get).toHaveLength(1);
    });

    it('marks a registry 401 as signed out in the error it gives', async () => {
        const { service, mock } = mockedService();
        mock.onGet('/api/calm/extensions').reply(401);
        const error = await service.fetchExtensions().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ExtensionRegistryError);
        expect((error as ExtensionRegistryError).signedOut).toBe(true);
    });
});

describe('useExtensionService', () => {
    function Probe({ onService }: { onService: (service: ExtensionService) => void }) {
        onService(useExtensionService());
        return null;
    }

    it('gives the provider service to each component', () => {
        const service = new ExtensionService();
        vi.spyOn(service, 'fetchExtensions').mockReturnValue(new Promise(() => {}));
        const seen: ExtensionService[] = [];
        render(
            <ExtensionsProvider service={service}>
                <Probe onService={(s) => seen.push(s)} />
                <Probe onService={(s) => seen.push(s)} />
            </ExtensionsProvider>
        );
        expect(seen.length).toBeGreaterThan(0);
        expect(seen.every((s) => s === service)).toBe(true);
    });

    it('gives a component its own service outside a provider', () => {
        const seen: ExtensionService[] = [];
        render(<Probe onService={(s) => seen.push(s)} />);
        expect(seen[0]).toBeInstanceOf(ExtensionService);
    });
});
