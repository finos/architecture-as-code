import { HubClient, type NamespaceSummary } from './hub-client';
import type { BuildingBlockDef } from './workspace-asset-service';

export interface HubNamespace {
    name: string;
    buildingBlocks: BuildingBlockDef[];
    standards: BuildingBlockDef[];
}

export class HubAssetService {
    private namespaces: HubNamespace[] = [];
    private client: HubClient;

    constructor(client: HubClient) {
        this.client = client;
    }

    async refresh(): Promise<HubNamespace[]> {
        const nsList: NamespaceSummary[] = await this.client.getNamespaces();
        this.namespaces = [];

        for (const ns of nsList) {
            const namespace: HubNamespace = {
                name: ns.name,
                buildingBlocks: [],
                standards: [],
            };

            try {
                const blocks = await this.client.getResources(
                    ns.name,
                    'building-blocks'
                );
                const versionResults = await Promise.all(
                    blocks.map((block) =>
                        this.client
                            .getVersions(ns.name, 'building-blocks', block.uniqueId)
                            .then((versions) => ({ block, versions }))
                            .catch(() => ({ block, versions: [] as string[] }))
                    )
                );
                for (const { block, versions } of versionResults) {
                    const latestSha =
                        versions.length > 0
                            ? versions[versions.length - 1]
                            : undefined;
                    // Fetch content to get the actual node-type and display name
                    let nodeType = 'service';
                    let displayName = block.name || humanize(block.uniqueId);
                    if (latestSha) {
                        try {
                            const content = await this.client.getResourceAtVersion(
                                ns.name, 'building-blocks', block.uniqueId, latestSha
                            ) as Record<string, unknown>;
                            const nodes = content?.nodes as Array<Record<string, unknown>> | undefined;
                            if (nodes?.[0]?.['node-type']) {
                                nodeType = nodes[0]['node-type'] as string;
                            }
                            if (nodes?.[0]?.name) {
                                displayName = nodes[0].name as string;
                            } else if (content?.title) {
                                displayName = content.title as string;
                            }
                        } catch { /* fallback */ }
                    }
                    namespace.buildingBlocks.push({
                        id: block.uniqueId,
                        name: displayName,
                        behaviour: 'create-node',
                        controls: {},
                        nodeType,
                        namespace: ns.name,
                        sha: latestSha,
                    });
                }
            } catch {
                /* namespace may not have building-blocks */
            }

            try {
                const standards = await this.client.getResources(
                    ns.name,
                    'standards'
                );
                const versionResults = await Promise.all(
                    standards.map((std) =>
                        this.client
                            .getVersions(ns.name, 'standards', std.uniqueId)
                            .then((versions) => ({ std, versions }))
                            .catch(() => ({ std, versions: [] as string[] }))
                    )
                );
                for (const { std, versions } of versionResults) {
                    const latestSha =
                        versions.length > 0
                            ? versions[versions.length - 1]
                            : undefined;
                    namespace.standards.push({
                        id: std.uniqueId,
                        name: std.name || humanize(std.uniqueId),
                        behaviour: 'apply-controls-on-drop',
                        controls: {},
                        nodeType: 'standard',
                        namespace: ns.name,
                        sha: latestSha,
                    });
                }
            } catch {
                /* namespace may not have standards */
            }

            this.namespaces.push(namespace);
        }

        return this.namespaces;
    }

    getNamespaces(): HubNamespace[] {
        return this.namespaces;
    }

    getAllBuildingBlocks(selectedNamespaces: string[]): BuildingBlockDef[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.buildingBlocks);
    }

    getAllStandards(selectedNamespaces: string[]): BuildingBlockDef[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.standards);
    }
}

function humanize(slug: string): string {
    return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
