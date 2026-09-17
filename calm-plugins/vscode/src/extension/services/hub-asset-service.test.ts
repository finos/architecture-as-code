import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubAssetService } from './hub-asset-service';
import { HubClient } from './hub-client';

function createMockClient(): HubClient {
    return {
        getNamespaces: vi.fn(),
        getResources: vi.fn(),
        getVersions: vi.fn(),
        getResourceAtVersion: vi.fn(),
        getAdrs: vi.fn().mockResolvedValue([]),
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
        it('fetches building blocks for each namespace', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
                { name: 'acme' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (ns: string, type: string) => {
                    if (ns === 'finos' && type === 'building-blocks') {
                        return Promise.resolve([
                            { uniqueId: 'microservice', name: 'Microservice', numericId: 1 },
                        ]);
                    }
                    if (ns === 'acme' && type === 'building-blocks') {
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
            expect(namespaces[0].buildingBlocks).toHaveLength(1);
            expect(namespaces[0].buildingBlocks[0]).toEqual(
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
            expect(namespaces[1].buildingBlocks).toHaveLength(1);
        });

        it('handles namespace with no building-blocks gracefully', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'empty-ns' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            const namespaces = await service.refresh();

            expect(namespaces).toHaveLength(1);
            expect(namespaces[0].buildingBlocks).toHaveLength(0);
            expect(namespaces[0].patterns).toHaveLength(0);
        });

        it('uses latest version (last element) as SHA', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'building-blocks') {
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

            expect(namespaces[0].buildingBlocks[0].sha).toBe('v3-latest');
        });

        it('sets sha to undefined when no versions exist', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'building-blocks') {
                        return Promise.resolve([
                            { uniqueId: 'svc', name: 'Service', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

            const namespaces = await service.refresh();

            expect(namespaces[0].buildingBlocks[0].sha).toBeUndefined();
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

    describe('getAllBuildingBlocks', () => {
        it('returns flattened blocks from all namespaces', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
                { name: 'ns2' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (ns: string, type: string) => {
                    if (type === 'building-blocks') {
                        return Promise.resolve([
                            { uniqueId: `${ns}-block`, name: `${ns} Block`, numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['v1']);

            await service.refresh();

            const blocks = service.getAllBuildingBlocks(["ns1", "ns2"]);
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

    describe('ADR fetching', () => {
        it('flattens and normalizes ADR summaries per namespace', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockResolvedValue([]);
            (mockClient.getAdrs as ReturnType<typeof vi.fn>).mockResolvedValue([
                { id: 1, title: 'Use Event Sourcing', status: 'Accepted' },
                { id: 2, status: 'proposed' },
            ]);

            await service.refresh();

            const adrs = service.getAllAdrs(['finos']);
            expect(adrs).toEqual([
                { namespace: 'finos', id: 1, title: 'Use Event Sourcing', status: 'accepted' },
                { namespace: 'finos', id: 2, title: '', status: 'proposed' },
            ]);
        });

        it('filters out summaries with a null id', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockResolvedValue([]);
            (mockClient.getAdrs as ReturnType<typeof vi.fn>).mockResolvedValue([
                { id: null, title: 'Malformed' },
                { id: 5, title: 'Good', status: 'draft' },
            ]);

            await service.refresh();

            const adrs = service.getAllAdrs(['finos']);
            expect(adrs).toHaveLength(1);
            expect(adrs[0].id).toBe(5);
        });

        it('isolates ADR fetch failures from other assets', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'finos' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'building-blocks') {
                        return Promise.resolve([
                            { uniqueId: 'svc', name: 'Service', numericId: 1 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['v1']);
            (mockClient.getAdrs as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('403 forbidden')
            );

            const namespaces = await service.refresh();

            expect(namespaces[0].adrs).toHaveLength(0);
            expect(namespaces[0].buildingBlocks).toHaveLength(1);
        });
    });
});
