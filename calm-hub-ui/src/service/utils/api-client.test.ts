import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import AxiosMockAdapter from 'axios-mock-adapter';

vi.mock('../../../authService.js', () => ({
    getAuthHeaders: vi.fn().mockResolvedValue({}),
}));

const mockSetAuthError = vi.fn();
vi.mock('./auth-store.js', () => ({
    authStore: {
        setAuthError: mockSetAuthError,
    },
}));

describe('apiClient interceptor', () => {
    let mock: AxiosMockAdapter;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { apiClient } = await import('./api-client.js');
        mock = new AxiosMockAdapter(apiClient);
    });

    afterEach(() => {
        mock.restore();
        vi.resetModules();
    });

    it('calls setAuthError(401) on 401', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(401);

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetAuthError).toHaveBeenCalledWith(401);
    });

    it('calls setAuthError(403) on 403', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(403);

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetAuthError).toHaveBeenCalledWith(403);
    });

    it('does not call setAuthError for other errors', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(500);

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetAuthError).not.toHaveBeenCalled();
    });

    it('passes through successful responses unchanged', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(200, { ok: true });

        const res = await apiClient.get('/test');
        expect(res.data).toEqual({ ok: true });
        expect(mockSetAuthError).not.toHaveBeenCalled();
    });
});
