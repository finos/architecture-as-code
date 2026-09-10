export interface HubAuthConfig {
    authEnabled: boolean;
    oidcAuthority?: string;
    oidcClientId?: string;
    oidcScopes?: string;
}

interface RawAuthConfigResponse {
    oidc?: {
        enabled?: boolean;
        authority?: string;
        clientId?: string;
        scopes?: string[];
        provider?: string;
    };
    github?: {
        enabled?: boolean;
        oauthClientId?: string;
    };
    databaseMode?: string;
}

export interface NamespaceSummary {
    name: string;
}

export interface ResourceSummary {
    name: string;
    uniqueId: string;
    numericId: number;
    versionCount?: number;
    customId?: string;
}

export class HubClient {
    private baseUrl: string;
    private authHeaders: Record<string, string> = {};

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    setAuthHeaders(headers: Record<string, string>): void {
        this.authHeaders = headers;
    }

    async getAuthConfig(): Promise<HubAuthConfig> {
        const res = await fetch(`${this.baseUrl}/api/calm/auth/config`);
        if (!res.ok) throw new Error(`Auth config failed: ${res.status}`);
        const raw: RawAuthConfigResponse = await res.json();
        return {
            authEnabled: raw.oidc?.enabled ?? false,
            oidcAuthority: raw.oidc?.authority,
            oidcClientId: raw.oidc?.clientId,
            oidcScopes: raw.oidc?.scopes?.join(' '),
        };
    }

    async getNamespaces(): Promise<NamespaceSummary[]> {
        const res = await this.authenticatedFetch('/api/calm/namespaces');
        const data = await res.json();
        return this.unwrapValues(data);
    }

    async getResources(
        namespace: string,
        type: string
    ): Promise<ResourceSummary[]> {
        const res = await this.authenticatedFetch(
            `/calm/namespaces/${namespace}/${type}`
        );
        const data = await res.json();
        const raw = this.unwrapValues<Record<string, unknown>>(data);
        return raw.map((item) => ({
            name: (item.name as string) || (item.customId as string) || '',
            uniqueId: (item.uniqueId as string) || (item.customId as string) || '',
            numericId: (item.numericId as number) || 0,
            versionCount: item.versionCount as number | undefined,
        }));
    }

    async getVersions(
        namespace: string,
        type: string,
        name: string
    ): Promise<string[]> {
        const res = await this.authenticatedFetch(
            `/calm/namespaces/${namespace}/${type}/${name}/versions`
        );
        const data = await res.json();
        return this.unwrapValues(data);
    }

    async getResourceAtVersion(
        namespace: string,
        type: string,
        name: string,
        version: string
    ): Promise<unknown> {
        const res = await this.authenticatedFetch(
            `/calm/namespaces/${namespace}/${type}/${name}/versions/${version}`
        );
        return res.json();
    }

    private unwrapValues<T>(data: unknown): T[] {
        if (
            data !== null &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            'values' in data &&
            Array.isArray((data as Record<string, unknown>).values)
        ) {
            return (data as Record<string, unknown>).values as T[];
        }
        return data as T[];
    }

    private async authenticatedFetch(path: string): Promise<Response> {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, {
            headers: { ...this.authHeaders, Accept: 'application/json' },
        });
        if (!res.ok)
            throw new Error(`Hub request failed: ${res.status} ${url}`);
        return res;
    }
}
