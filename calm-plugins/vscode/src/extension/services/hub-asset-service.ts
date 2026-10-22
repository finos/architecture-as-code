import { HubClient, type NamespaceSummary } from './hub-client';
import type { StandardNodeDef, PatternEntry } from './workspace-asset-service';

export interface HubNamespace {
    name: string;
    standardNodes: StandardNodeDef[];
    patterns: PatternEntry[];
}

export class HubAssetService {
    private namespaces: HubNamespace[] = [];
    private client: HubClient;

    constructor(client: HubClient) {
        this.client = client;
    }

    async refresh(): Promise<HubNamespace[]> {
        const nsList: NamespaceSummary[] = await this.client.getNamespaces();
        this.namespaces = await Promise.all(nsList.map(ns => this.fetchNamespace(ns.name)));
        return this.namespaces;
    }

    getNamespaces(): HubNamespace[] {
        return this.namespaces;
    }

    loadFromCache(cached: HubNamespace[]): void {
        this.namespaces = cached;
    }

    async deltaRefresh(): Promise<{ changed: boolean }> {
        const nsList: NamespaceSummary[] = await this.client.getNamespaces();
        const oldByName = new Map(this.namespaces.map(ns => [ns.name, ns]));
        let changed = false;

        const updated: HubNamespace[] = [];
        for (const ns of nsList) {
            const old = oldByName.get(ns.name);
            if (!old) {
                changed = true;
                updated.push(await this.fetchNamespace(ns.name));
                continue;
            }

            // Check if standards changed by comparing version listings.
            // NOTE: getVersions is called here to detect changes, and again
            // inside fetchNamespace for the actual fetch. This is intentional —
            // only changed namespaces pay the double cost, and caching the
            // intermediate result would add complexity for little gain.
            let needsStandardRefresh = false;
            try {
                const blocks = await this.client.getResources(ns.name, 'standards');
                const oldShaMap = new Map(old.standardNodes.map(n => [n.id, n.sha]));
                if (blocks.length !== old.standardNodes.length) {
                    needsStandardRefresh = true;
                } else {
                    const versionChecks = await Promise.all(
                        blocks.map(async (block) => {
                            const oldSha = oldShaMap.get(block.uniqueId);
                            if (!oldSha) return true;
                            try {
                                const versions = await this.client.getVersions(ns.name, 'standards', String(block.numericId));
                                if (versions.length === 0) return true;
                                return versions[versions.length - 1] !== oldSha;
                            } catch {
                                // Assume changed on network error to avoid masking real updates
                                return true;
                            }
                        })
                    );
                    needsStandardRefresh = versionChecks.some(Boolean);
                }
            } catch { /* keep cached standards */ }

            if (needsStandardRefresh) {
                changed = true;
                updated.push(await this.fetchNamespace(ns.name));
            } else {
                // Standards unchanged — re-fetch patterns and ADRs (lightweight).
                // Start with old data so partial failures preserve cached content.
                const refreshed: HubNamespace = { ...old };
                await this.fetchPatterns(refreshed);
                const patternsChanged = refreshed.patterns.length !== old.patterns.length ||
                    refreshed.patterns.some((p, i) => p.id !== old.patterns[i]?.id || p.sha !== old.patterns[i]?.sha);
                if (patternsChanged) changed = true;
                updated.push(refreshed);
            }
        }

        if (updated.length !== this.namespaces.length) changed = true;

        this.namespaces = updated;
        return { changed };
    }

    private async fetchNamespace(nsName: string): Promise<HubNamespace> {
        const namespace: HubNamespace = { name: nsName, standardNodes: [], patterns: [] };

        try {
            const blocks = await this.client.getResources(nsName, 'standards');
            const versionResults = await Promise.all(
                blocks.map((block) =>
                    this.client.getVersions(nsName, 'standards', String(block.numericId))
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
                                nsName, 'standards', String(block.numericId), latestSha
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
                    id: block.uniqueId || String(block.numericId), name: displayName, behaviour: 'create-node',
                    controls, nodeType, namespace: nsName, sha: latestSha, hubId: block.numericId,
                });
            }
        } catch { /* namespace may not have standards */ }

        await this.fetchPatterns(namespace);

        return namespace;
    }

    private async fetchPatterns(namespace: HubNamespace): Promise<void> {
        const nsName = namespace.name;
        const newPatterns: typeof namespace.patterns = [];
        try {
            const patterns = await this.client.getResources(nsName, 'patterns');
            const patResults = await Promise.all(
                patterns.map((pat) =>
                    this.client.getVersions(nsName, 'patterns', String(pat.numericId))
                        .then((versions) => ({ pat, versions }))
                        .catch(() => ({ pat, versions: [] as string[] }))
                )
            );
            for (const { pat, versions } of patResults) {
                const latestSha = versions.length > 0 ? versions[versions.length - 1] : undefined;
                if (!latestSha) continue;
                try {
                    const content = await this.client.getResourceAtVersion(nsName, 'patterns', String(pat.numericId), latestSha) as Record<string, unknown>;
                    newPatterns.push({
                        id: pat.uniqueId || String(pat.numericId),
                        name: (content.title as string) || pat.name || humanize(pat.uniqueId),
                        description: (content.description as string) || '',
                        category: (content.category as string) || (content['x-category'] as string) || nsName,
                        schema: content,
                        sha: latestSha,
                    });
                } catch { /* skip individual pattern */ }
            }
            namespace.patterns = newPatterns;
        } catch { /* namespace may not have patterns — keeps existing */ }
    }

    getAllStandardNodes(selectedNamespaces: string[]): StandardNodeDef[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.standardNodes);
    }

    getAllPatterns(selectedNamespaces: string[]): PatternEntry[] {
        const filtered = this.namespaces.filter((ns) => selectedNamespaces.includes(ns.name));
        return filtered.flatMap((ns) => ns.patterns);
    }

    async pinControlVersions(controls: Record<string, unknown>): Promise<void> {
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

export function humanize(slug: string): string {
    return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
