import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubAssetService } from './hub-asset-service';
import { HubClient } from './hub-client';

function createMockClient(): HubClient {
    return {
        getNamespaces: vi.fn(),
        getResources: vi.fn(),
        getVersions: vi.fn(),
        getResourceAtVersion: vi.fn(),
    } as unknown as HubClient;
}

describe('HubAssetService', () => {
    let service: HubAssetService;
    let mockClient: HubClient;

    beforeEach(() => {
        mockClient = createMockClient();
        service = new HubAssetService(mockClient);
    });

    describe('refresh', () => {
        it('fetches standard nodes for each namespace', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
                { name: 'acme' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (ns: string, type: string) => {
                    if (ns === 'finos' && type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'microservice', name: 'Microservice', numericId: 1 },
                        ]);
                    }
                    if (ns === 'acme' && type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'api-gateway', name: 'API Gateway', numericId: 3 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, _type: string, _name: string) => {
                    return Promise.resolve(['sha-1', 'sha-2', 'sha-latest']);
                }
            );

            const namespaces = await service.refresh();

            expect(namespaces).toHaveLength(2);
            expect(namespaces[0].name).toBe('finos');
            expect(namespaces[0].standardNodes).toHaveLength(1);
            expect(namespaces[0].standardNodes[0]).toEqual(
                expect.objectContaining({
                    id: 'microservice',
                    name: 'Microservice',
                    behaviour: 'create-node',
                    namespace: 'finos',
                    sha: 'sha-latest',
                    nodeType: 'service',
                })
            );
            expect(namespaces[1].name).toBe('acme');
            expect(namespaces[1].standardNodes).toHaveLength(1);
        });

        it('handles namespace with no standard-nodes gracefully', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'empty-ns' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            const namespaces = await service.refresh();

            expect(namespaces).toHaveLength(1);
            expect(namespaces[0].standardNodes).toHaveLength(0);
            expect(namespaces[0].patterns).toHaveLength(0);
        });

        it('uses latest version (last element) as SHA', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'svc', name: 'Service', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue([
                'v1',
                'v2',
                'v3-latest',
            ]);

            const namespaces = await service.refresh();

            expect(namespaces[0].standardNodes[0].sha).toBe('v3-latest');
        });

        it('sets sha to undefined when no versions exist', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'svc', name: 'Service', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

            const namespaces = await service.refresh();

            expect(namespaces[0].standardNodes[0].sha).toBeUndefined();
        });
    });

    describe('getNamespaces', () => {
        it('returns empty array before refresh', () => {
            expect(service.getNamespaces()).toEqual([]);
        });

        it('returns cached namespaces after refresh', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockResolvedValue([]);

            await service.refresh();

            expect(service.getNamespaces()).toHaveLength(1);
            expect(service.getNamespaces()[0].name).toBe('ns1');
        });
    });

    describe('getAllStandardNodes', () => {
        it('returns flattened blocks from all namespaces', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
                { name: 'ns2' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (ns: string, type: string) => {
                    if (type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: `${ns}-block`, name: `${ns} Block`, numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['v1']);

            await service.refresh();

            const blocks = service.getAllStandardNodes(["ns1", "ns2"]);
            expect(blocks).toHaveLength(2);
            expect(blocks[0].namespace).toBe('ns1');
            expect(blocks[1].namespace).toBe('ns2');
        });
    });

    describe('getAllPatterns', () => {
        it('returns flattened patterns from selected namespaces', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'patterns') {
                        return Promise.resolve([
                            { uniqueId: 'api-pattern', name: 'API Pattern', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['sha-1']);
            (mockClient.getResourceAtVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
                title: 'API Gateway Pattern',
                description: 'A standard API gateway topology',
                category: 'networking',
                properties: { nodes: { prefixItems: [] }, relationships: { prefixItems: [] } },
            });

            await service.refresh();

            const patterns = service.getAllPatterns(['ns1']);
            expect(patterns).toHaveLength(1);
            expect(patterns[0]).toEqual(expect.objectContaining({
                id: 'api-pattern',
                name: 'API Gateway Pattern',
                description: 'A standard API gateway topology',
                category: 'networking',
            }));
            expect(patterns[0].schema).toBeDefined();
        });

        it('skips patterns with no versions', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'patterns') {
                        return Promise.resolve([
                            { uniqueId: 'no-version', name: 'No Version', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

            await service.refresh();

            expect(service.getAllPatterns(['ns1'])).toHaveLength(0);
        });

        it('handles namespace with no patterns gracefully', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            const namespaces = await service.refresh();

            expect(namespaces[0].patterns).toHaveLength(0);
        });

        it('uses namespace name as category fallback', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'patterns') {
                        return Promise.resolve([
                            { uniqueId: 'minimal', name: 'Minimal', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['v1']);
            (mockClient.getResourceAtVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
                title: 'Minimal Pattern',
                properties: {},
            });

            await service.refresh();

            const patterns = service.getAllPatterns(['finos']);
            expect(patterns[0].category).toBe('finos');
        });
    });

    describe('controls extraction and version pinning', () => {
        it('extracts controls from the fetched standard content', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([{ name: 'ns1' }]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') return Promise.resolve([{ uniqueId: 'svc', name: 'Service', numericId: 1 }]);
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['sha1']);
            (mockClient.getResourceAtVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
                nodes: [{
                    'node-type': 'service',
                    name: 'My Service',
                    controls: {
                        'encryption': {
                            description: 'Encryption',
                            requirements: [{ 'requirement-url': 'domain:controls:encrypt' }],
                        },
                    },
                }],
            });
            // resolveControlId and getRequirementVersions for version pinning
            (mockClient as any).resolveControlId = vi.fn().mockResolvedValue({ id: 10, domain: 'domain' });
            (mockClient as any).getRequirementVersions = vi.fn().mockResolvedValue(['v1', 'v2']);

            const namespaces = await service.refresh();
            const controls = namespaces[0].standardNodes[0].controls as Record<string, any>;

            expect(controls.encryption).toBeDefined();
            expect(controls.encryption.requirements[0]['requirement-url']).toBe('domain:controls:encrypt@v2');
        });

        it('keeps unversioned CURIE when version lookup fails', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([{ name: 'ns1' }]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') return Promise.resolve([{ uniqueId: 'svc', name: 'Svc', numericId: 1 }]);
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['sha1']);
            (mockClient.getResourceAtVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
                nodes: [{
                    'node-type': 'service',
                    controls: {
                        'ctrl': { requirements: [{ 'requirement-url': 'domain:controls:x' }] },
                    },
                }],
            });
            (mockClient as any).resolveControlId = vi.fn().mockRejectedValue(new Error('not found'));

            const namespaces = await service.refresh();
            const controls = namespaces[0].standardNodes[0].controls as Record<string, any>;
            expect(controls.ctrl.requirements[0]['requirement-url']).toBe('domain:controls:x');
        });

        it('skips already-versioned CURIEs', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([{ name: 'ns1' }]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') return Promise.resolve([{ uniqueId: 'svc', name: 'Svc', numericId: 1 }]);
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['sha1']);
            (mockClient.getResourceAtVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
                nodes: [{
                    'node-type': 'service',
                    controls: {
                        'ctrl': { requirements: [{ 'requirement-url': 'domain:controls:x@v1' }] },
                    },
                }],
            });
            (mockClient as any).resolveControlId = vi.fn();

            const namespaces = await service.refresh();
            const controls = namespaces[0].standardNodes[0].controls as Record<string, any>;
            expect(controls.ctrl.requirements[0]['requirement-url']).toBe('domain:controls:x@v1');
            expect((mockClient as any).resolveControlId).not.toHaveBeenCalled();
        });
    });
});
