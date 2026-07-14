import { SMOKE_HUB_URL } from '../global-setup';

async function getJson(url: string): Promise<Record<string, unknown>> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
}

/**
 * Thin REST probe over CalmHub, used to assert hub state independently of the
 * CLI's own client. Response shapes match @finos/calm-shared's CalmHubClient.
 */
export function hubApi(baseUrl: string = SMOKE_HUB_URL) {
    return {
        baseUrl,
        async listNamespaces(): Promise<string[]> {
            const body = await getJson(`${baseUrl}/api/calm/namespaces`);
            const values = (body.values ?? []) as { name: string }[];
            return values.map((v) => v.name);
        },
        async listMappings(namespace: string, type: string): Promise<string[]> {
            const body = await getJson(`${baseUrl}/calm/namespaces/${namespace}/${type}`);
            const values = (body.values ?? []) as { customId: string }[];
            return values.map((v) => v.customId);
        },
        async listVersions(namespace: string, type: string, mapping: string): Promise<string[]> {
            const body = await getJson(
                `${baseUrl}/calm/namespaces/${namespace}/${type}/${mapping}/versions`
            );
            return (body.values ?? []) as string[];
        },
        async getDocument(
            namespace: string,
            type: string,
            mapping: string,
            version: string
        ): Promise<Record<string, unknown>> {
            return getJson(
                `${baseUrl}/calm/namespaces/${namespace}/${type}/${mapping}/versions/${version}`
            );
        },
    };
}
