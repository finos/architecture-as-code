import axios, { Axios } from 'axios';
import { AuthPlugin } from '../auth/auth-plugin';

export interface CalmHubOptions {
    calmHubUrl?: string;
    authPlugin?: AuthPlugin;
}

export interface HubNamespaceSummary {
    name: string;
    description?: string;
}

export interface HubArchitectureSummary {
    id: number;
    name: string;
    description?: string;
    versions: string[];
}

export interface HubPatternSummary {
    id: number;
    name: string;
    description?: string;
    versions: string[];
}

export interface HubStandardSummary {
    id: number;
    name: string;
    description?: string;
    versions: string[];
}

export interface HubCreateResult {
    id: number;
    version?: string;
    location: string;
}

export interface HubNamespaceCreateResult {
    name: string;
    location: string;
}

export interface HubDomainCreateResult {
    name: string;
    location: string;
}

export interface HubDomainSummary {
    name: string;
}

export interface HubControlSummary {
    id: number;
    name: string;
    description?: string;
}

export class HubClientError extends Error {
    /**
     * Creates a normalized Hub client error.
     * @param status HTTP status code or 0 for non-HTTP failures.
     * @param error Error message.
     * @param request Request label that failed.
     */
    constructor(
        public readonly status: number,
        public readonly error: string,
        public readonly request: string
    ) {
        super(`Hub error ${status} on ${request}: ${error}`);
        this.name = 'HubClientError';
    }
}

export class CalmHubClient {
    private readonly ax: Axios;

    /**
     * Creates a Hub client bound to a base URL and optional auth plugin.
     * @param options Hub connection options.
     * @param axiosInstance Optional injected axios instance for testing.
     */
    constructor(options: CalmHubOptions, axiosInstance?: Axios) {
        const baseUrl = options.calmHubUrl;
       
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                baseURL: baseUrl,
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (options.authPlugin) {
            this.ax.interceptors.request.use(async (config) => {
                const fullUrl = (config.baseURL || '') + (config.url || '');
                const authHeaders = await options.authPlugin.getAuthHeaders(fullUrl, config.data);
                Object.assign(config.headers, authHeaders);
                return config;
            });
        }
    }

    // ── Namespaces ───────────────────────────────────────────────────────────

    /**
     * Creates a namespace.
     * @param name Namespace name.
     * @param description Namespace description.
     * @returns Created namespace result with location.
     */
    async createNamespace(name: string, description: string): Promise<HubNamespaceCreateResult> {
        const endpoint = 'POST /calm/namespaces';
        try {
            const response = await this.ax.post('/calm/namespaces', { name, description });
            const location = (response.headers['location'] as string | undefined) ?? `/calm/namespaces/${name}`;
            return { name, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists namespaces.
     * @returns Namespace summaries.
     */
    async listNamespaces(): Promise<HubNamespaceSummary[]> {
        const endpoint = 'GET /calm/namespaces';
        try {
            const response = await this.ax.get('/calm/namespaces');
            const values: HubNamespaceSummary[] = response.data?.values ?? [];
            return values;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Architectures ────────────────────────────────────────────────────────

    /**
     * Creates a new architecture.
     * @param namespace Namespace name.
     * @param name Architecture name.
     * @param description Architecture description.
     * @param architectureJson Architecture JSON payload.
     * @returns Created resource metadata.
     */
    async pushArchitecture(
        namespace: string,
        name: string,
        description: string,
        architectureJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/architectures`;
        try {
            const response = await this.ax.post(`/calm/namespaces/${namespace}/architectures`, {
                name,
                description,
                architectureJson
            });
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Creates a new version for an existing architecture.
     * @param namespace Namespace name.
     * @param id Architecture id.
     * @param version Version label.
     * @param name Architecture name.
     * @param description Architecture description.
     * @param architectureJson Architecture JSON payload.
     * @returns Created resource metadata.
     */
    async pushArchitectureVersion(
        namespace: string,
        id: number,
        version: string,
        name: string,
        description: string,
        architectureJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/architectures/${id}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/namespaces/${namespace}/architectures/${id}/versions/${version}`,
                { name, description, architectureJson }
            );
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists architectures and their versions in a namespace.
     * @param namespace Namespace name.
     * @returns Architecture summaries.
     */
    async listArchitectures(namespace: string): Promise<HubArchitectureSummary[]> {
        const endpoint = `GET /calm/namespaces/${namespace}/architectures`;
        try {
            const response = await this.ax.get(`/calm/namespaces/${namespace}/architectures`);
            const items: { id: number; name: string; description?: string }[] =
                response.data?.values ?? [];
            const summaries = await Promise.all(
                items.map(async (item) => {
                    const versionsEndpoint = `GET /calm/namespaces/${namespace}/architectures/${item.id}/versions`;
                    try {
                        const vRes = await this.ax.get(
                            `/calm/namespaces/${namespace}/architectures/${item.id}/versions`
                        );
                        const versions: string[] = vRes.data?.values ?? [];
                        return { id: item.id, name: item.name, description: item.description, versions };
                    } catch (err) {
                        throw this.wrapError(err, versionsEndpoint);
                    }
                })
            );
            return summaries;
        } catch (err) {
            if (err instanceof HubClientError) throw err;
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pulls a specific architecture version.
     * @param namespace Namespace name.
     * @param id Architecture id.
     * @param version Version label.
     * @returns Architecture document.
     */
    async pullArchitecture(namespace: string, id: number, version: string): Promise<object> {
        const endpoint = `GET /calm/namespaces/${namespace}/architectures/${id}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/namespaces/${namespace}/architectures/${id}/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Patterns ─────────────────────────────────────────────────────────────

    /**
     * Creates a new pattern.
     * @param namespace Namespace name.
     * @param name Pattern name.
     * @param description Pattern description.
     * @param patternJson Pattern JSON payload.
     * @returns Created resource metadata.
     */
    async pushPattern(
        namespace: string,
        name: string,
        description: string,
        patternJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/patterns`;
        try {
            const response = await this.ax.post(`/calm/namespaces/${namespace}/patterns`, {
                name,
                description,
                patternJson
            });
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Creates a new version for an existing pattern.
     * @param namespace Namespace name.
     * @param id Pattern id.
     * @param version Version label.
     * @param _name Unused name parameter kept for compatibility.
     * @param _description Unused description parameter kept for compatibility.
     * @param patternJson Pattern JSON payload.
     * @returns Created resource metadata.
     */
    async pushPatternVersion(
        namespace: string,
        id: number,
        version: string,
        _name: string,
        _description: string,
        patternJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/patterns/${id}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/namespaces/${namespace}/patterns/${id}/versions/${version}`,
                patternJson
            );
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists patterns and their versions in a namespace.
     * @param namespace Namespace name.
     * @returns Pattern summaries.
     */
    async listPatterns(namespace: string): Promise<HubPatternSummary[]> {
        const endpoint = `GET /calm/namespaces/${namespace}/patterns`;
        try {
            const response = await this.ax.get(`/calm/namespaces/${namespace}/patterns`);
            const items: { id: number; name: string; description?: string }[] =
                response.data?.values ?? [];
            const summaries = await Promise.all(
                items.map(async (item) => {
                    const versionsEndpoint = `GET /calm/namespaces/${namespace}/patterns/${item.id}/versions`;
                    try {
                        const vRes = await this.ax.get(
                            `/calm/namespaces/${namespace}/patterns/${item.id}/versions`
                        );
                        const versions: string[] = vRes.data?.values ?? [];
                        return { id: item.id, name: item.name, description: item.description, versions };
                    } catch (err) {
                        throw this.wrapError(err, versionsEndpoint);
                    }
                })
            );
            return summaries;
        } catch (err) {
            if (err instanceof HubClientError) throw err;
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pulls a specific pattern version.
     * @param namespace Namespace name.
     * @param id Pattern id.
     * @param version Version label.
     * @returns Pattern document.
     */
    async pullPattern(namespace: string, id: number, version: string): Promise<object> {
        const endpoint = `GET /calm/namespaces/${namespace}/patterns/${id}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/namespaces/${namespace}/patterns/${id}/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Standards ─────────────────────────────────────────────────────────────

    /**
     * Creates a new standard.
     * @param namespace Namespace name.
     * @param name Standard name.
     * @param description Standard description.
     * @param standardJson Standard JSON payload.
     * @returns Created resource metadata.
     */
    async pushStandard(
        namespace: string,
        name: string,
        description: string,
        standardJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/standards`;
        try {
            const response = await this.ax.post(`/calm/namespaces/${namespace}/standards`, {
                name,
                description,
                standardJson
            });
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Creates a new version for an existing standard.
     * @param namespace Namespace name.
     * @param id Standard id.
     * @param version Version label.
     * @param name Standard name.
     * @param description Standard description.
     * @param standardJson Standard JSON payload.
     * @returns Created resource metadata.
     */
    async pushStandardVersion(
        namespace: string,
        id: number,
        version: string,
        name: string,
        description: string,
        standardJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/namespaces/${namespace}/standards/${id}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/namespaces/${namespace}/standards/${id}/versions/${version}`,
                { name, description, standardJson }
            );
            const location = response.headers['location'] as string;
            return this.parseVersionedLocation(location, endpoint);
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists standards and their versions in a namespace.
     * @param namespace Namespace name.
     * @returns Standard summaries.
     */
    async listStandards(namespace: string): Promise<HubStandardSummary[]> {
        const endpoint = `GET /calm/namespaces/${namespace}/standards`;
        try {
            const response = await this.ax.get(`/calm/namespaces/${namespace}/standards`);
            const items: { id: number; name: string; description?: string }[] =
                response.data?.values ?? [];
            const summaries = await Promise.all(
                items.map(async (item) => {
                    const versionsEndpoint = `GET /calm/namespaces/${namespace}/standards/${item.id}/versions`;
                    try {
                        const vRes = await this.ax.get(
                            `/calm/namespaces/${namespace}/standards/${item.id}/versions`
                        );
                        const versions: string[] = vRes.data?.values ?? [];
                        return { id: item.id, name: item.name, description: item.description, versions };
                    } catch (err) {
                        throw this.wrapError(err, versionsEndpoint);
                    }
                })
            );
            return summaries;
        } catch (err) {
            if (err instanceof HubClientError) throw err;
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pulls a specific standard version.
     * @param namespace Namespace name.
     * @param id Standard id.
     * @param version Version label.
     * @returns Standard document.
     */
    async pullStandard(namespace: string, id: number, version: string): Promise<object> {
        const endpoint = `GET /calm/namespaces/${namespace}/standards/${id}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/namespaces/${namespace}/standards/${id}/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Domains/Controls ─────────────────────────────────────────────────────

    /**
     * Creates a domain.
     * @param name Domain name.
     * @returns Created domain metadata.
     */
    async createDomain(name: string): Promise<HubDomainCreateResult> {
        const endpoint = 'POST /calm/domains';
        try {
            await this.ax.post('/calm/domains', { name });
            return { name, location: `/calm/domains/${name}` };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists domains.
     * @returns Domain summaries.
     */
    async listDomains(): Promise<HubDomainSummary[]> {
        const endpoint = 'GET /calm/domains';
        try {
            const response = await this.ax.get('/calm/domains');
            const values: HubDomainSummary[] = response.data?.values ?? [];
            return values;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Creates a control requirement.
     * @param domain Domain name.
     * @param name Control name.
     * @param description Control description.
     * @param requirementJson Requirement JSON payload.
     * @returns Created resource metadata.
     */
    async createControl(domain: string, name: string, description: string, requirementJson: string): Promise<HubCreateResult> {
        const endpoint = `POST /calm/domains/${domain}/controls`;
        try {
            const response = await this.ax.post(`/calm/domains/${domain}/controls`, { name, description, requirementJson });
            const location = (response.headers['location'] as string | undefined) ?? `/calm/domains/${domain}/controls`;
            const id = this.parseIdFromLocation(location, endpoint);
            return { id, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists controls for a domain.
     * @param domain Domain name.
     * @returns Control summaries.
     */
    async listControls(domain: string): Promise<HubControlSummary[]> {
        const endpoint = `GET /calm/domains/${domain}/controls`;
        try {
            const response = await this.ax.get(`/calm/domains/${domain}/controls`);
            const values: HubControlSummary[] = response.data?.values ?? [];
            return values;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pushes a versioned control requirement.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param version Version label.
     * @param name Requirement wrapper name.
     * @param description Requirement wrapper description.
     * @param requirementJson Requirement JSON payload.
     * @returns Created resource metadata.
     */
    async pushControlRequirement(
        domain: string,
        controlId: number,
        version: string,
        name: string,
        description: string,
        requirementJson: string
    ): Promise<HubCreateResult> {
        const endpoint = `POST /calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`,
                { name, description, requirementJson },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
            return { id: controlId, version, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pulls a versioned control requirement.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param version Version label.
     * @returns Requirement document.
     */
    async pullControlRequirement(domain: string, controlId: number, version: string): Promise<object> {
        const endpoint = `GET /calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pushes a versioned control configuration.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param configId Configuration id.
     * @param version Version label.
     * @param configJson Configuration JSON payload.
     * @returns Created resource metadata.
     */
    async pushControlConfiguration(domain: string, controlId: number, configId: number, version: string, configJson: string): Promise<HubCreateResult> {
        const endpoint = `POST /calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`,
                { configurationJson: configJson },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
            return { id: configId, version, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Pulls a versioned control configuration.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param configId Configuration id.
     * @param version Version label.
     * @returns Configuration document.
     */
    async pullControlConfiguration(domain: string, controlId: number, configId: number, version: string): Promise<object> {
        const endpoint = `GET /calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`
            );
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Creates a control configuration.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param configurationJson Configuration JSON payload.
     * @returns Created resource metadata.
     */
    async createControlConfiguration(domain: string, controlId: number, configurationJson: string): Promise<HubCreateResult> {
        const endpoint = `POST /calm/domains/${domain}/controls/${controlId}/configurations`;
        try {
            const response = await this.ax.post(
                `/calm/domains/${domain}/controls/${controlId}/configurations`,
                { configurationJson }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/calm/domains/${domain}/controls/${controlId}/configurations`;
            const id = this.parseIdFromLocation(location, endpoint);
            return { id, location };
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists control configuration ids for a control.
     * @param domain Domain name.
     * @param controlId Control id.
     * @returns Configuration ids.
     */
    async listControlConfigurations(domain: string, controlId: number): Promise<number[]> {
        const endpoint = `GET /calm/domains/${domain}/controls/${controlId}/configurations`;
        try {
            const response = await this.ax.get(`/calm/domains/${domain}/controls/${controlId}/configurations`);
            return (response.data?.values ?? []) as number[];
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists control requirement versions.
     * @param domain Domain name.
     * @param controlId Control id.
     * @returns Requirement versions.
     */
    async listControlRequirementVersions(domain: string, controlId: number): Promise<string[]> {
        const endpoint = `GET /calm/domains/${domain}/controls/${controlId}/requirement/versions`;
        try {
            const response = await this.ax.get(`/calm/domains/${domain}/controls/${controlId}/requirement/versions`);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists control configuration versions.
     * @param domain Domain name.
     * @param controlId Control id.
     * @param configId Configuration id.
     * @returns Configuration versions.
     */
    async listControlConfigurationVersions(domain: string, controlId: number, configId: number): Promise<string[]> {
        const endpoint = `GET /calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`;
        try {
            const response = await this.ax.get(`/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Parses id and version from a Location header of the form
     * /calm/namespaces/{ns}/{resource-type}/{id}/versions/{version}
     */
    private parseVersionedLocation(location: string, endpoint: string): HubCreateResult {
        const match = /\/(\d+)\/versions\/([^/]+)$/.exec(location);
        if (!match) {
            throw new HubClientError(0, `Could not parse location header: ${location}`, endpoint);
        }
        return {
            id: parseInt(match[1], 10),
            version: match[2],
            location
        };
    }

    /**
     * Parses a resource id from a Location header of the form
     * /calm/.../{id} or /calm/.../{id}/
     */
    private parseIdFromLocation(location: string, endpoint: string): number {
        const match = /\/(\d+)\/?$/.exec(location);
        if (!match) {
            throw new HubClientError(0, `Could not parse location header: ${location}`, endpoint);
        }
        return parseInt(match[1], 10);
    }

    /**
     * Converts unknown errors into HubClientError with endpoint context.
     * @param err Unknown thrown value.
     * @param endpoint Endpoint label.
     * @returns Normalized Hub client error.
     */
    private wrapError(err: unknown, endpoint: string): HubClientError {
        if (err instanceof HubClientError) return err;
        if (axios.isAxiosError(err) && err.response) {
            const status = err.response.status;
            const body = err.response.data;
            let message: string;
            if (typeof body === 'string') {
                message = body;
            } else if (body && typeof body === 'object' && 'error' in body) {
                message = String((body as { error: string }).error);
            } else {
                message = err.message;
            }
            return new HubClientError(status, message, endpoint);
        }
        return new HubClientError(0, err instanceof Error ? err.message : String(err), endpoint);
    }
}
