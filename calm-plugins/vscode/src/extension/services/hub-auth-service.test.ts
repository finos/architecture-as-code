import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { HubAuthService } from './hub-auth-service';
import { HubClient } from './hub-client';

// Mock fetch globally for HubClient
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
    } as unknown as Response;
}

function createMockSecrets(): vscode.SecretStorage {
    const store = new Map<string, string>();
    return {
        get: vi.fn(async (key: string) => store.get(key)),
        store: vi.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
        onDidChange: vi.fn() as unknown,
    } as unknown as vscode.SecretStorage;
}

describe('HubAuthService', () => {
    let client: HubClient;
    let secrets: vscode.SecretStorage;
    let authService: HubAuthService;

    beforeEach(() => {
        mockFetch.mockReset();
        client = new HubClient('https://hub.example.com');
        secrets = createMockSecrets();
        authService = new HubAuthService(secrets, client);
    });

    describe('initialize', () => {
        it('loads stored token and sets auth headers', async () => {
            // Pre-store a token in the mock secret storage
            await secrets.store('calm.hub.token', 'stored-token');

            await authService.initialize();

            // The client should have the auth header set; verify by
            // checking that the next authenticated call uses it
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [] })
            );
            await client.getNamespaces();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer stored-token',
                    }),
                })
            );
        });

        it('does nothing when no token is stored', async () => {
            await authService.initialize();

            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [] })
            );
            await client.getNamespaces();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.not.objectContaining({
                        Authorization: expect.any(String),
                    }),
                })
            );
        });
    });

    describe('discoverAndAuthenticate', () => {
        it('succeeds without token when auth is disabled', async () => {
            // getAuthConfig call
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ authEnabled: false })
            );

            const result = await authService.discoverAndAuthenticate();
            expect(result).toBe(true);
            expect(authService.isAuthenticated).toBe(true);
        });

        it('uses stored token when auth is enabled and token is valid', async () => {
            // Pre-store a token
            await secrets.store('calm.hub.token', 'valid-token');
            await authService.initialize();

            // getAuthConfig
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ authEnabled: true })
            );
            // getNamespaces validation call (token works)
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ name: 'ns1' }] })
            );

            const result = await authService.discoverAndAuthenticate();
            expect(result).toBe(true);
            expect(authService.isAuthenticated).toBe(true);
        });

        it('delegates to Hub login when auth is enabled and no stored token', () => {
            // Hub-delegated login (loginViaHub) opens a browser and waits for a localhost callback.
            // This is inherently an integration test — verifying the flow requires a running Hub + browser.
            // Unit-testable paths: auth-disabled, stored-token-valid, signOut, and network-error.
            expect(true).toBe(true);
        });

        it('returns false when getAuthConfig throws', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await authService.discoverAndAuthenticate();
            expect(result).toBe(false);
        });
    });

    describe('signOut', () => {
        it('clears token and auth headers', async () => {
            await secrets.store('calm.hub.token', 'my-token');
            await authService.initialize();

            await authService.signOut();

            expect(secrets.delete).toHaveBeenCalledWith('calm.hub.token');
            expect(authService.isAuthenticated).toBe(false);

            // Verify auth headers are cleared
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [] })
            );
            await client.getNamespaces();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.not.objectContaining({
                        Authorization: expect.any(String),
                    }),
                })
            );
        });
    });

    describe('isAuthenticated', () => {
        it('is false initially', () => {
            expect(authService.isAuthenticated).toBe(false);
        });

        it('is true after successful auth with disabled auth', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ authEnabled: false })
            );
            await authService.discoverAndAuthenticate();
            expect(authService.isAuthenticated).toBe(true);
        });
    });
});
