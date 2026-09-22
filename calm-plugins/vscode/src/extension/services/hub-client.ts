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

/** A control listed under a Hub domain. `name` is the kebab-case slug used in API paths. */
export interface ControlDetail {
    id: number;
    name: string;
    description: string;
    title?: string;
}

/** Summary entry from `GET /adrs` — flat, top-level fields. `id` may be null for malformed rows. */
export interface AdrSummary {
    id: number | null;
    title?: string;
    status?: string;
}

/** Flattened ADR content (from the `adr` member of the `AdrMeta` wrapper). */
export interface AdrContent {
    title: string;
    status: string;
    contextAndProblemStatement?: string;
    decisionDrivers?: string[];
    consideredOptions?: unknown[];
    decisionOutcome?: unknown;
    links?: unknown[];
}

/** Wrapper returned by `GET /adrs/{id}` — ADR content is nested under `adr`. */
export interface AdrMeta {
    namespace: string;
    id: number;
    revision: number;
    adr: AdrContent;
}

/** Typed HTTP error so callers can branch on `status` (e.g. 403 domain access denied). */
export class HubApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly url: string,
        message: string
    ) {
        super(message);
        this.name = 'HubApiError';
    }
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

    // --- Domains & controls (name-mapped `/calm/domains` API) ---

    async getDomains(): Promise<string[]> {
        const res = await this.authenticatedFetch('/calm/domains');
        const data = await res.json();
        return this.unwrapValues<string>(data);
    }

    async getControlsForDomain(domain: string): Promise<ControlDetail[]> {
        const res = await this.authenticatedFetch(
            `/calm/domains/${encodeURIComponent(domain)}/controls`
        );
        const data = await res.json();
        return this.unwrapValues<ControlDetail>(data);
    }

    async resolveControlId(domain: string, controlName: string): Promise<{ id: number; domain: string }> {
        try {
            const controls = await this.getControlsForDomain(domain);
            const match = controls.find((c) => c.name === controlName);
            if (match) return { id: match.id, domain };
        } catch {
            // Domain may not exist (e.g. CURIE uses a namespace prefix, not a Hub domain)
        }
        const domains = await this.getDomains();
        for (const d of domains) {
            if (d === domain) continue;
            try {
                const controls = await this.getControlsForDomain(d);
                const match = controls.find((c) => c.name === controlName);
                if (match) return { id: match.id, domain: d };
            } catch { continue; }
        }
        throw new HubApiError(404, '', `Control "${controlName}" not found in domain "${domain}" or any other domain`);
    }

    async getRequirementVersions(
        domain: string,
        controlId: number
    ): Promise<string[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions`
        );
        const data = await res.json();
        return this.unwrapValues<string>(data);
    }

    async getRequirementAtVersion(
        domain: string,
        controlId: number,
        version: string
    ): Promise<unknown> {
        const res = await this.authenticatedFetch(
            `/api/calm/domains/${encodeURIComponent(domain)}/controls/${controlId}/requirement/versions/${encodeURIComponent(version)}`
        );
        return res.json();
    }

    // --- ADRs (namespace-scoped storage API, numeric IDs) ---

    async getAdrs(namespace: string): Promise<AdrSummary[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs`
        );
        const data = await res.json();
        return this.unwrapValues<AdrSummary>(data);
    }

    async getAdr(namespace: string, adrId: number): Promise<AdrMeta> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${adrId}`
        );
        return (await res.json()) as AdrMeta;
    }

    async getAdrRevisions(
        namespace: string,
        adrId: number
    ): Promise<number[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${adrId}/revisions`
        );
        const data = await res.json();
        return this.unwrapValues<number>(data);
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
            throw new HubApiError(
                res.status,
                url,
                `Hub request failed: ${res.status} ${url}`
            );
        return res;
    }
}
