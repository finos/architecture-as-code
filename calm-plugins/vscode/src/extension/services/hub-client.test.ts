import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubClient, HubApiError, describeHubError } from './hub-client';

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
                'https://hub.example.com/api/calm/namespaces/finos/architectures',
                expect.any(Object)
            );
        });

        it('maps a string id and tags from the new Hub contract', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ name: 'api-gateway', id: 'aws/prod/api-gateway', customId: 'gw', versionCount: 2, tags: { path: 'aws/prod', variant: 'markdown' } }] })
            );
            const result = await client.getResources('finos', 'standards');
            expect(result[0]).toEqual({
                name: 'api-gateway',
                uniqueId: 'gw',
                id: 'aws/prod/api-gateway',
                versionCount: 2,
                tags: { path: 'aws/prod', variant: 'markdown' },
            });
        });

        it('coerces a legacy numeric id to a string and ignores numericId', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ name: 'svc', customId: 'my-svc', id: 42, numericId: 7 }] })
            );
            const result = await client.getResources('finos', 'standards');
            expect(result[0].id).toBe('42');
            expect(result[0].uniqueId).toBe('my-svc');
            expect(result[0]).not.toHaveProperty('numericId');
        });

        it('uses the string id as uniqueId when customId is absent', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ name: 'svc', id: 'aws/prod/svc' }] })
            );
            const result = await client.getResources('finos', 'standards');
            expect(result[0].uniqueId).toBe('aws/prod/svc');
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
                'https://hub.example.com/api/calm/namespaces/finos/architectures/my-arch/versions',
                expect.any(Object)
            );
        });

        it('appends encoded path and variant tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['v1'] }));

            await client.getVersions('finos', 'standards', 'aws/prod/api-gateway', {
                path: 'aws/prod',
                variant: 'markdown file',
            });
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/standards/aws%2Fprod%2Fapi-gateway/versions?path=aws%2Fprod&variant=markdown+file',
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
                'https://hub.example.com/api/calm/namespaces/finos/architectures/my-arch/versions/1.0',
                expect.any(Object)
            );
        });

        it('appends encoded path and variant tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [] }));

            await client.getResourceAtVersion('finos', 'standards', 'aws/prod/svc', 'v1', {
                path: 'aws/prod',
                variant: 'markdown',
            });
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/standards/aws%2Fprod%2Fsvc/versions/v1?path=aws%2Fprod&variant=markdown',
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
        it('resolves a control name to its string ID, domain and tags', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: [{ id: 'control-42', name: 'micro-segmentation', description: 'd', tags: { path: 'aws/prod' } }] })
            );
            const result = await client.resolveControlId('security', 'micro-segmentation');
            expect(result).toEqual({ id: 'control-42', domain: 'security', tags: { path: 'aws/prod' } });
        });

        it('prefers a matching path when a domain has several same-named controls', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({
                values: [
                    { id: 'aws/prod/seg', name: 'seg', description: '', tags: { path: 'aws/prod' } },
                    { id: 'aws/dev/seg', name: 'seg', description: '', tags: { path: 'aws/dev' } },
                ],
            }));
            const result = await client.resolveControlId('security', 'seg', { path: 'aws/dev' });
            expect(result.id).toBe('aws/dev/seg');
            expect(result.tags).toEqual({ path: 'aws/dev' });
        });

        it('falls back to searching other domains when primary domain 404s', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['platform', 'network'] }));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [{ id: '99', name: 'seg', description: '' }] }));
            const result = await client.resolveControlId('bad-domain', 'seg');
            expect(result).toEqual({ id: '99', domain: 'platform', tags: undefined });
        });

        it('throws when not found in any domain', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['platform'] }));
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [{ id: '1', name: 'other', description: '' }] }));
            await expect(client.resolveControlId('bad', 'missing')).rejects.toThrow('not found');
        });
    });

    describe('getRequirementVersions', () => {
        it('constructs the string-id requirement versions URL', async () => {
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ values: ['1.0.0', '1.1.0'] })
            );

            const result = await client.getRequirementVersions('security', 'control-42');
            expect(result).toEqual(['1.0.0', '1.1.0']);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/control-42/requirement/versions',
                expect.any(Object)
            );
        });

        it('appends encoded path and variant tags', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: ['v1'] }));

            await client.getRequirementVersions('security', 'aws/prod/seg', {
                path: 'aws/prod',
                variant: 'markdown',
            });
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/aws%2Fprod%2Fseg/requirement/versions?path=aws%2Fprod&variant=markdown',
                expect.any(Object)
            );
        });
    });

    describe('getRequirementAtVersion', () => {
        it('returns the raw requirement JSON (no values wrapper)', async () => {
            const schema = { $id: 'x', properties: {} };
            mockFetch.mockResolvedValueOnce(jsonResponse(schema));

            const result = await client.getRequirementAtVersion('security', 'control-42', '1.0.0');
            expect(result).toEqual(schema);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/control-42/requirement/versions/1.0.0',
                expect.any(Object)
            );
        });

        it('appends tags after the version', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({}));

            await client.getRequirementAtVersion('security', 'aws/prod/seg', 'v1', { path: 'aws/prod' });
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/domains/security/controls/aws%2Fprod%2Fseg/requirement/versions/v1?path=aws%2Fprod',
                expect.any(Object)
            );
        });
    });

    describe('ADR methods', () => {
        it('getAdrs unwraps the summary list with string ids', async () => {
            const adrs = [{ id: 'adr-1', title: 'Use X', status: 'accepted' }];
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: adrs }));

            const result = await client.getAdrs('finos');
            expect(result).toEqual(adrs);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs',
                expect.any(Object)
            );
        });

        it('getAdr returns the AdrMeta wrapper with a string id and numeric revision', async () => {
            const meta = {
                namespace: 'finos',
                id: 'adr-3',
                revision: 2,
                adr: { title: 'Use X', status: 'accepted' },
            };
            mockFetch.mockResolvedValueOnce(jsonResponse(meta));

            const result = await client.getAdr('finos', 'adr-3');
            expect(result).toEqual(meta);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs/adr-3',
                expect.any(Object)
            );
        });

        it('getAdrRevisions keeps revisions numeric with a string ADR id', async () => {
            mockFetch.mockResolvedValueOnce(jsonResponse({ values: [1, 2, 3] }));

            const result = await client.getAdrRevisions('finos', 'adr-3');
            expect(result).toEqual([1, 2, 3]);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://hub.example.com/api/calm/namespaces/finos/adrs/adr-3/revisions',
                expect.any(Object)
            );
        });
    });

    describe('describeHubError', () => {
        it('gives actionable guidance for an ambiguous resource id (400)', () => {
            const err = new HubApiError(400, 'https://hub/.../controls/seg/requirement/versions', 'bad');
            expect(describeHubError(err)).toContain('add a folder path or variant');
        });

        it('gives actionable guidance when a resource id cannot be found (404)', () => {
            const err = new HubApiError(404, 'https://hub/.../namespaces/finos/standards/seg/versions', 'bad');
            expect(describeHubError(err)).toContain('add a folder path or variant');
        });

        it('does not add resource-id guidance to unrelated 404s', () => {
            const err = new HubApiError(404, 'https://hub/calm/domains', 'bad');
            expect(describeHubError(err)).toBe('Hub request failed (404)');
        });
    });
});
