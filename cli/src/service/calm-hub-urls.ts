export const calmHubResourceVersionsUrl = (namespace: string, customId: string) =>
    `/calm/namespaces/${namespace}/${customId}/versions`;
export const calmHubResourceLatestVersionUrl = (namespace: string, customId: string) =>
    `/calm/namespaces/${namespace}/${customId}`;
export const calmHubResourceSpecificVersionUrl = (namespace: string, customId: string, version: string) =>
    `/calm/namespaces/${namespace}/${customId}/versions/${version}`;