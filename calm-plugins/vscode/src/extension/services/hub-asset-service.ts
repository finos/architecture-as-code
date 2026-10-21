import { HubClient, type NamespaceSummary } from './hub-client';
import type { StandardNodeDef, PatternEntry } from './workspace-asset-service';
import type { AdrEntry } from '../types/messages';

export interface HubNamespace {
    name: string;
    standardNodes: StandardNodeDef[];
    patterns: PatternEntry[];
    adrs: AdrEntry[];
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
                standardNodes: [],
                patterns: [],
                adrs: [],
            };

            try {
                const blocks = await this.client.getResources(
                    ns.name,
                    'standards'
                );
                const versionResults = await Promise.all(
                    blocks.map((block) =>
                        this.client
                            .getVersions(ns.name, 'standards', String(block.numericId))
                            .then((versions) => ({ block, versions }))
                            .catch(() => ({ block, versions: [] as string[] }))
                    )
                );
                const contentResults = await Promise.all(
                    versionResults.map(async ({ block, versions }) => {
                        const latestSha = versions.length > 0 ? versions[versions.length - 1] : undefined;
                        let nodeType = 'service';
                        let displayName = block.name || humanize(block.uniqueId);
                        let controls: Record<string, unknown> = {};
                        if (latestSha) {
                            try {
                                const content = await this.client.getResourceAtVersion(
                                    ns.name, 'standards', String(block.numericId), latestSha
                                ) as Record<string, unknown>;
                                const nodes = content?.nodes as Array<Record<string, unknown>> | undefined;
                                if (nodes?.[0]?.['node-type']) nodeType = nodes[0]['node-type'] as string;
                                if (nodes?.[0]?.name) displayName = nodes[0].name as string;
                                else if (content?.title) displayName = content.title as string;
                                if (nodes?.[0]?.controls && typeof nodes[0].controls === 'object') {
                                    controls = nodes[0].controls as Record<string, unknown>;
                                    await this.pinControlVersions(controls);
                                }
                            } catch { /* fallback */ }
                        }
                        return { block, latestSha, nodeType, displayName, controls };
                    })
                );
                for (const { block, latestSha, nodeType, displayName, controls } of contentResults) {
                    namespace.standardNodes.push({
                        id: block.uniqueId,
                        name: displayName,
                        behaviour: 'create-node',
                        controls,
                        nodeType,
                        namespace: ns.name,
                        sha: latestSha,
                        hubId: block.numericId,
                    });
                }
            } catch {
                /* namespace may not have standard-nodes */
            }

            try {
                const patterns = await this.client.getResources(
                    ns.name,
                    'patterns'
                );
                const versionResults = await Promise.all(
                    patterns.map((pat) =>
                        this.client
                            .getVersions(ns.name, 'patterns', pat.uniqueId)
                            .then((versions) => ({ pat, versions }))
                            .catch(() => ({ pat, versions: [] as string[] }))
                    )
                );
                for (const { pat, versions } of versionResults) {
                    const latestSha =
                        versions.length > 0
                            ? versions[versions.length - 1]
                            : undefined;
                    if (!latestSha) continue;
                    try {
                        const content = await this.client.getResourceAtVersion(
                            ns.name, 'patterns', pat.uniqueId, latestSha
                        ) as Record<string, unknown>;
                        namespace.patterns.push({
                            id: pat.uniqueId,
                            name: (content.title as string) || pat.name || humanize(pat.uniqueId),
                            description: (content.description as string) || '',
                            category: (content.category as string) || (content['x-category'] as string) || ns.name,
                            schema: content,
                        });
                    } catch { /* skip unreadable pattern */ }
                }
            } catch {
                /* namespace may not have patterns */
            }

            // ADR fetch is isolated in its own try/catch so a failure here never
            // blocks standard-node / standard / pattern loading for this namespace.
            try {
                const adrSummaries = await this.client.getAdrs(ns.name);
                for (const adr of adrSummaries) {
                    if (adr.id === null || adr.id === undefined) continue;
                    namespace.adrs.push({
                        namespace: ns.name,
                        id: adr.id,
                        title: adr.title ?? '',
                        status: (adr.status ?? '').toLowerCase(),
                    });
                }
            } catch {
                /* namespace may not expose ADRs, or the caller lacks access */
            }

            this.namespaces.push(namespace);
        }

        return this.namespaces;
    }

    getNamespaces(): HubNamespace[] {
        return this.namespaces;
    }

    getAllStandardNodes(selectedNamespaces: string[]): StandardNodeDef[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.standardNodes);
    }

    getAllPatterns(selectedNamespaces: string[]): PatternEntry[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.patterns);
    }

    getAllAdrs(selectedNamespaces: string[]): AdrEntry[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.adrs);
    }

    private async pinControlVersions(controls: Record<string, unknown>): Promise<void> {
        const tasks: Array<{ req: Record<string, unknown>; url: string }> = [];
        for (const ctrl of Object.values(controls)) {
            if (!ctrl || typeof ctrl !== 'object') continue;
            const c = ctrl as Record<string, unknown>;
            const reqs = c.requirements as Array<Record<string, unknown>> | undefined;
            if (!reqs) continue;
            for (const req of reqs) {
                const url = req['requirement-url'];
                if (typeof url !== 'string' || !url.includes(':controls:') || url.includes('@')) continue;
                const parts = url.split(':');
                if (parts.length !== 3 || parts[1] !== 'controls') continue;
                tasks.push({ req, url });
            }
        }
        await Promise.all(tasks.map(async ({ req, url }) => {
            try {
                const [domain, , controlName] = url.split(':');
                const resolved = await this.client.resolveControlId(domain, controlName);
                const versions = await this.client.getRequirementVersions(resolved.domain, resolved.id);
                if (versions.length > 0) {
                    req['requirement-url'] = `${url}@${versions[versions.length - 1]}`;
                }
            } catch { /* keep unversioned */ }
        }));
    }
}

function humanize(slug: string): string {
    return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
