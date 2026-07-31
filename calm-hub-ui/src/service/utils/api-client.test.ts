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

const mockSetMigrationError = vi.fn();
vi.mock('./migration-store.js', () => ({
    migrationStore: {
        setMigrationError: mockSetMigrationError,
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

    it('calls setMigrationError with the backend-provided message on 503', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(503, 'CalmHub is applying a schema migration and cannot serve requests right now.');

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetMigrationError).toHaveBeenCalledWith(
            'CalmHub is applying a schema migration and cannot serve requests right now.'
        );
    });

    it('falls back to a default message on 503 when the body is not usable text', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(503, { unexpected: 'shape' });

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetMigrationError).toHaveBeenCalledWith('CalmHub is temporarily unavailable. Please try again shortly.');
    });

    it('does not call setMigrationError for other errors', async () => {
        const { apiClient } = await import('./api-client.js');
        mock.onGet('/test').reply(500);

        await expect(apiClient.get('/test')).rejects.toThrow();
        expect(mockSetMigrationError).not.toHaveBeenCalled();
    });
});
