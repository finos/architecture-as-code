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
        it('fetches building blocks and standards for each namespace', async () => {
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
                    if (ns === 'finos' && type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'tls-policy', name: 'TLS Policy', numericId: 2 },
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
            expect(namespaces[0].standards).toHaveLength(1);
            expect(namespaces[0].standards[0]).toEqual(
                expect.objectContaining({
                    id: 'tls-policy',
                    name: 'TLS Policy',
                    behaviour: 'apply-controls-on-drop',
                    namespace: 'finos',
                    sha: 'sha-latest',
                    nodeType: 'standard',
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
            expect(namespaces[0].standards).toHaveLength(0);
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

    describe('getAllStandards', () => {
        it('returns flattened standards from all namespaces', async () => {
            (mockClient.getNamespaces as ReturnType<typeof vi.fn>).mockResolvedValue([
                { name: 'ns1' },
            ]);
            (mockClient.getResources as ReturnType<typeof vi.fn>).mockImplementation(
                (_ns: string, type: string) => {
                    if (type === 'standards') {
                        return Promise.resolve([
                            { uniqueId: 'std-a', name: 'Standard A', numericId: 1 },
                            { uniqueId: 'std-b', name: 'Standard B', numericId: 2 },
                        ]);
                    }
                    return Promise.resolve([]);
                }
            );
            (mockClient.getVersions as ReturnType<typeof vi.fn>).mockResolvedValue(['v1']);

            await service.refresh();

            const stds = service.getAllStandards(["ns1", "ns2"]);
            expect(stds).toHaveLength(2);
            expect(stds[0].behaviour).toBe('apply-controls-on-drop');
            expect(stds[1].behaviour).toBe('apply-controls-on-drop');
        });
    });
});
