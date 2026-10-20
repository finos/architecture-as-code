import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubClient, HubApiError } from './hub-client';

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

    describe('HubApiError', () => {
        it('throws a typed error carrying the status and url on 403', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 403));

            const err = await client.getDomains().catch((e) => e);
            expect(err).toBeInstanceOf(HubApiError);
            expect(err.status).toBe(403);
            expect(err.url).toBe('https://hub.example.com/calm/domains');
        });

        it('carries a 404 status', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));

            const err = await client
                .getControlsForDomain('security')
                .catch((e) => e);
            expect(err).toBeInstanceOf(HubApiError);
            expect(err.status).toBe(404);
        });
    });

    describe('getDomains', () => {
        it('unwraps the values wrapper into a string array', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: ['security', 'privacy'] })
            );

            const result = await client.getDomains();
            expect(result).toEqual(['security', 'privacy']);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/calm/domains',
                expect.any(Object)
            );
        });
    });

    describe('getControlsForDomain', () => {
        it('returns control details and encodes the domain', async () => {
            const controls = [
                { id: 1, name: 'micro-segmentation', description: 'd', title: 't' },
            ];
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: controls }));

            const result = await client.getControlsForDomain('security');
            expect(result).toEqual(controls);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/calm/domains/security/controls',
                expect.any(Object)
            );
        });
    });

    describe('resolveControlId', () => {
        it('resolves a control name to its numeric ID and domain', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ id: 42, name: 'micro-segmentation', description: 'd' }] })
            );
            const result = await client.resolveControlId('security', 'micro-segmentation');
            expect(result).toEqual({ id: 42, domain: 'security' });
        });

        it('falls back to searching other domains when primary domain 404s', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['platform', 'network'] }));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [{ id: 99, name: 'seg', description: '' }] }));
            const result = await client.resolveControlId('bad-domain', 'seg');
            expect(result).toEqual({ id: 99, domain: 'platform' });
        });

        it('throws when not found in any domain', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['platform'] }));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [{ id: 1, name: 'other', description: '' }] }));
            await expect(client.resolveControlId('bad', 'missing')).rejects.toThrow('not found');
        });
    });

    describe('getRequirementVersions', () => {
        it('constructs the numeric-ID requirement versions URL', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: ['1.0.0', '1.1.0'] })
            );

            const result = await client.getRequirementVersions('security', 42);
            expect(result).toEqual(['1.0.0', '1.1.0']);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/42/requirement/versions',
                expect.any(Object)
            );
        });
    });

    describe('getRequirementAtVersion', () => {
        it('returns the raw requirement JSON (no values wrapper)', async () => {
            const schema = { $id: 'x', properties: {} };
            mockFetch.mockResolvedValueOnce(jsonResponse(schema));

            const result = await client.getRequirementAtVersion('security', 42, '1.0.0');
            expect(result).toEqual(schema);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/42/requirement/versions/1.0.0',
                expect.any(Object)
            );
        });
    });

    describe('ADR methods', () => {
        it('getAdrs unwraps the summary list', async () => {
            const adrs = [{ id: 1, title: 'Use X', status: 'accepted' }];
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: adrs }));

            const result = await client.getAdrs('finos');
            expect(result).toEqual(adrs);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs',
                expect.any(Object)
            );
        });

        it('getAdr returns the AdrMeta wrapper with nested adr content', async () => {
            const meta = {
                namespace: 'finos',
                id: 3,
                revision: 2,
                adr: { title: 'Use X', status: 'accepted' },
            };
            mockFetch.mockResolvedValueOnce(jsonResponse(meta));

            const result = await client.getAdr('finos', 3);
            expect(result).toEqual(meta);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs/3',
                expect.any(Object)
            );
        });

        it('getAdrRevisions unwraps numeric revisions', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [1, 2, 3] }));

            const result = await client.getAdrRevisions('finos', 3);
            expect(result).toEqual([1, 2, 3]);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs/3/revisions',
                expect.any(Object)
            );
        });
    });
});
