import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubClient } from './hub-client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
    } as unknown as Response;
}

describe('HubClient', () => {
    let client: HubClient;

    beforeEach(() => {
        mockFetch.mockReset();
        client = new HubClient('https://hub.example.com/');
    });

    it('strips trailing slash from base URL', () => {
        // Verify by calling getAuthConfig and checking the URL passed to fetch
        mockFetch.mockResolvedValueOnce(
            jsonResponse({ authEnabled: false })
        );
        client.getAuthConfig();
        expect(mockFetch).toHaveBeenCalledWith(
            'https://hub.example.com/api/calm/auth/config'
        );
    });

    describe('getAuthConfig', () => {
        it('returns auth config on success', async () => {
            const rawResponse = {
                oidc: {
                    enabled: true,
                    authority: 'https://auth.example.com',
                    clientId: 'calm-vscode',
                    scopes: ['openid', 'profile'],
                },
            };
            mockFetch.mockResolvedValueOnce(jsonResponse(rawResponse));

            const result = await client.getAuthConfig();
            expect(result).toEqual({
                authEnabled: true,
                oidcAuthority: 'https://auth.example.com',
                oidcClientId: 'calm-vscode',
                oidcScopes: 'openid profile',
            });
        });

        it('throws on non-OK response', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

            await expect(client.getAuthConfig()).rejects.toThrow(
                'Auth config failed: 500'
            );
        });
    });

    describe('getNamespaces', () => {
        it('returns namespaces from values wrapper', async () => {
            const namespaces = [{ name: 'finos' }, { name: 'internal' }];
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: namespaces })
            );

            const result = await client.getNamespaces();
            expect(result).toEqual(namespaces);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Accept: 'application/json',
                    }),
                })
            );
        });

        it('returns namespaces from bare array', async () => {
            const namespaces = [{ name: 'default' }];
            mockFetch.mockResolvedValueOnce(jsonResponse(namespaces));

            const result = await client.getNamespaces();
            expect(result).toEqual(namespaces);
        });

        it('includes auth headers when set', async () => {
            client.setAuthHeaders({
                Authorization: 'Bearer my-token',
            });
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [] }));

            await client.getNamespaces();
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer my-token',
                        Accept: 'application/json',
                    }),
                })
            );
        });

        it('throws on non-OK response', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 401));

            await expect(client.getNamespaces()).rejects.toThrow(
                'Hub request failed: 401'
            );
        });
    });

    describe('getResources', () => {
        it('constructs correct URL', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [] })
            );

            await client.getResources('finos', 'architectures');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/calm/namespaces/finos/architectures',
                expect.any(Object)
            );
        });
    });

    describe('getVersions', () => {
        it('constructs correct URL', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: ['1.0', '2.0'] })
            );

            const result = await client.getVersions(
                'finos',
                'architectures',
                'my-arch'
            );
            expect(result).toEqual(['1.0', '2.0']);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/calm/namespaces/finos/architectures/my-arch/versions',
                expect.any(Object)
            );
        });
    });

    describe('getResourceAtVersion', () => {
        it('returns parsed JSON body', async () => {
            const resource = { nodes: [], relationships: [] };
            mockFetch.mockResolvedValueOnce(jsonResponse(resource));

            const result = await client.getResourceAtVersion(
                'finos',
                'architectures',
                'my-arch',
                '1.0'
            );
            expect(result).toEqual(resource);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/calm/namespaces/finos/architectures/my-arch/versions/1.0',
                expect.any(Object)
            );
        });
    });
});
