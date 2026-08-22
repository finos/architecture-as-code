import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getAuthConfig, isOidcEnabled, isGitHubMode, isGitHubLinkingEnabled } from './authConfig.js';

vi.mock('axios');

describe('authConfig', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchAuthConfig', () => {
        it('should fetch config from backend', async () => {
            const mockConfig = {
                oidc: { enabled: true, provider: 'entra-id', authority: 'https://login.microsoft.com/tenant', clientId: 'client-123', scopes: ['openid', 'profile'] },
                github: { enabled: true, oauthClientId: 'gh-client' },
                databaseMode: 'github',
            };
            vi.mocked(axios.get).mockResolvedValue({ data: mockConfig });

            const { fetchAuthConfig: fetch } = await import('./authConfig.js');
            const result = await fetch();

            expect(result.oidc.enabled).toBe(true);
            expect(result.oidc.provider).toBe('entra-id');
            expect(result.github.enabled).toBe(true);
            expect(result.databaseMode).toBe('github');
        });

        it('should retry once and succeed on transient failure', async () => {
            const mockConfig = {
                oidc: { enabled: true, provider: 'generic-oidc' },
                github: { enabled: false },
                databaseMode: 'mongo',
            };
            vi.mocked(axios.get)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({ data: mockConfig });

            const { fetchAuthConfig: fetch } = await import('./authConfig.js');
            const result = await fetch();

            expect(result.oidc.enabled).toBe(true);
        });

        it('should throw when both attempts fail', async () => {
            vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

            const { fetchAuthConfig: fetch } = await import('./authConfig.js');

            await expect(fetch()).rejects.toThrow('Unable to load authentication configuration');
        });
    });

    describe('getAuthConfig', () => {
        it('should return default config before fetch', () => {
            const config = getAuthConfig();
            expect(config.oidc.enabled).toBe(false);
        });
    });

    describe('isOidcEnabled', () => {
        it('should return false when not fetched', () => {
            expect(isOidcEnabled()).toBe(false);
        });
    });

    describe('isGitHubMode', () => {
        it('should return false when not fetched', () => {
            expect(isGitHubMode()).toBe(false);
        });
    });

    describe('isGitHubLinkingEnabled', () => {
        it('should return false when not fetched', () => {
            expect(isGitHubLinkingEnabled()).toBe(false);
        });
    });
});
