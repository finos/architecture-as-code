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

/** Folder path and file-kind qualifier that disambiguate same-named GitHub resources. */
export interface Tags {
    path?: string;
    variant?: string;
}

export interface ResourceSummary {
    name: string;
    uniqueId: string;
    /** String resource id from the Hub; numeric ids from older Hubs are coerced to strings. */
    id: string;
    versionCount?: number;
    customId?: string;
    tags?: Tags;
}

/** A control listed under a Hub domain. `name` is the kebab-case slug used in API paths. */
export interface ControlDetail {
    id: string;
    name: string;
    description: string;
    title?: string;
    tags?: Tags;
}

/** Summary entry from `GET /adrs` — flat, top-level fields. `id` may be null for malformed rows. */
export interface AdrSummary {
    id: string | null;
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
    id: string;
    revision: number;
    adr: AdrContent;
}

const RESOURCE_ID_ROUTE = /\/namespaces\/|\/controls\/|\/adrs\//;

export function describeHubError(err: unknown): string {
    if (err instanceof HubApiError) {
        if (err.status === 403) return 'Access denied (403)';
        const base = `Hub request failed (${err.status})`;
        if ((err.status === 400 || err.status === 404) && RESOURCE_ID_ROUTE.test(err.url)) {
            return `${base}: the resource id may be ambiguous — add a folder path or variant to identify one resource`;
        }
        return base;
    }
    return err instanceof Error ? err.message : String(err);
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
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(type)}`
        );
        const data = await res.json();
        const raw = this.unwrapValues<Record<string, unknown>>(data);
        return raw.map((item) => {
            const id = item.id == null ? '' : String(item.id as string | number);
            return {
                name: (item.name as string) || (item.customId as string) || '',
                uniqueId: (item.customId as string) || id,
                id,
                versionCount: item.versionCount as number | undefined,
                tags: item.tags as Tags | undefined,
            };
        });
    }

    async getVersions(
        namespace: string,
        type: string,
        id: string,
        tags?: Tags
    ): Promise<string[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/versions${this.idQuery(tags)}`
        );
        const data = await res.json();
        return this.unwrapValues(data);
    }

    async getResourceAtVersion(
        namespace: string,
        type: string,
        id: string,
        version: string,
        tags?: Tags
    ): Promise<unknown> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/${encodeURIComponent(type)}/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}${this.idQuery(tags)}`
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

    async resolveControlId(
        domain: string,
        controlName: string,
        tags?: Tags
    ): Promise<{ id: string; domain: string; tags?: Tags }> {
        const pick = (controls: ControlDetail[]): ControlDetail | undefined => {
            const matches = controls.filter((c) => c.name === controlName);
            if (matches.length === 0) return undefined;
            if (matches.length === 1) return matches[0];
            return (tags?.path && matches.find((c) => c.tags?.path === tags.path)) || matches[0];
        };
        const toResult = (match: ControlDetail, foundIn: string) => ({
            id: String(match.id),
            domain: foundIn,
            tags: match.tags,
        });

        try {
            const match = pick(await this.getControlsForDomain(domain));
            if (match) return toResult(match, domain);
        } catch (err) {
            if (err instanceof HubApiError && err.status !== 404) throw err;
        }
        const domains = await this.getDomains();
        for (const d of domains) {
            if (d === domain) continue;
            try {
                const match = pick(await this.getControlsForDomain(d));
                if (match) return toResult(match, d);
            } catch (err) {
                if (err instanceof HubApiError && err.status !== 404) throw err;
            }
        }
        throw new HubApiError(404, '', `Control "${controlName}" not found in domain "${domain}" or any other domain`);
    }

    async getRequirementVersions(
        domain: string,
        controlId: string,
        tags?: Tags
    ): Promise<string[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/domains/${encodeURIComponent(domain)}/controls/${encodeURIComponent(controlId)}/requirement/versions${this.idQuery(tags)}`
        );
        const data = await res.json();
        return this.unwrapValues<string>(data);
    }

    async getRequirementAtVersion(
        domain: string,
        controlId: string,
        version: string,
        tags?: Tags
    ): Promise<unknown> {
        const res = await this.authenticatedFetch(
            `/api/calm/domains/${encodeURIComponent(domain)}/controls/${encodeURIComponent(controlId)}/requirement/versions/${encodeURIComponent(version)}${this.idQuery(tags)}`
        );
        return res.json();
    }

    // --- ADRs (namespace-scoped storage API; string ids, numeric revisions) ---

    async getAdrs(namespace: string): Promise<AdrSummary[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs`
        );
        const data = await res.json();
        return this.unwrapValues<AdrSummary>(data);
    }

    async getAdr(namespace: string, adrId: string): Promise<AdrMeta> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${encodeURIComponent(adrId)}`
        );
        return (await res.json()) as AdrMeta;
    }

    async getAdrRevisions(
        namespace: string,
        adrId: string
    ): Promise<number[]> {
        const res = await this.authenticatedFetch(
            `/api/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${encodeURIComponent(adrId)}/revisions`
        );
        const data = await res.json();
        return this.unwrapValues<number>(data);
    }

    private idQuery(tags?: Tags): string {
        const params = new URLSearchParams();
        if (tags?.path) params.set('path', tags.path);
        if (tags?.variant) params.set('variant', tags.variant);
        const query = params.toString();
        return query ? `?${query}` : '';
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
