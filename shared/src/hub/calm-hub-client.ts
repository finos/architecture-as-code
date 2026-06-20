import axios, { Axios, AxiosError } from 'axios';
import { AuthPlugin } from '../auth/auth-plugin';
import { initLogger, Logger } from '../logger';
import { DocumentMetadata, extractDocumentMetadata, validateDocumentId } from './document-id-utils';

export interface CalmHubOptions {
    calmHubUrl?: string;
    authPlugin?: AuthPlugin;
}

export interface HubNamespaceSummary {
    name: string;
    description?: string;
}

export interface HubCreateResult {
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
    id?: number;
    name: string;
    description?: string;
}

export type ResourceChangeType = 'MAJOR' | 'MINOR' | 'PATCH';

export type ResourceType = 'patterns' | 'architectures' | 'standards' | 'interfaces';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'standards', 'interfaces'];

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
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
    private readonly logger: Logger;

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
            const authPlugin = options.authPlugin;
            this.ax.interceptors.request.use(async (config) => {
                const fullUrl = (config.baseURL || '') + (config.url || '');
                const authHeaders = await authPlugin.getAuthHeaders(fullUrl, config.data);
                Object.assign(config.headers, authHeaders);
                return config;
            });
        }

        this.logger = initLogger(false, 'calm-hub-client');
    }

    // ── Namespaces ───────────────────────────────────────────────────────────

    /**
     * Creates a namespace.
     * @param name Namespace name.
     * @param description Namespace description.
     * @returns Created namespace result with location.
     */
    async createNamespace(name: string, description: string): Promise<HubNamespaceCreateResult> {
        // TODO should this move to user facing API? there is not a /calm/namespaces currently
        const endpoint = 'POST /api/calm/namespaces';
        try {
            const response = await this.ax.post('/api/calm/namespaces', { name, description });
            const location = (response.headers['location'] as string | undefined) ?? `/api/calm/namespaces/${name}`;
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
        const endpoint = 'GET /api/calm/namespaces';
        try {
            const response = await this.ax.get('/api/calm/namespaces');
            const values: HubNamespaceSummary[] = response.data?.values ?? [];
            return values;
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
        const endpoint = '/calm/domains';
        try {
            await this.ax.post(endpoint, { name });
            return { name, location: `${endpoint}/${name}` };
        } catch (err) {
            throw this.wrapError(err, `POST ${endpoint}`);
        }
    }

    /**
     * Lists domains.
     * @returns Domain summaries.
     */
    async listDomains(): Promise<HubDomainSummary[]> {
        const endpoint = '/calm/domains';
        try {
            const response = await this.ax.get(endpoint);
            const names: string[] = response.data?.values ?? [];
            return names.map(name => ({ name }));
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    // ── Controls (User Facing API, domain-scoped, name-addressed) ─────────────

    /**
     * Lists the controls in a domain. Each control carries its addressing name (slug) plus id/description.
     * @param domain Domain name.
     * @returns The control summaries, or an empty list if the domain has none.
     */
    async listControls(domain: string): Promise<HubControlSummary[]> {
        const endpoint = `/calm/domains/${domain}/controls`;
        try {
            const response = await this.ax.get(endpoint);
            return (response.data?.values ?? []) as HubControlSummary[];
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Lists the configurations for a named control. Each configuration carries its addressing name (slug).
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @returns The configuration summaries, or an empty list if the control has none.
     */
    async listControlConfigurations(domain: string, controlName: string): Promise<HubControlSummary[]> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/configurations`;
        try {
            const response = await this.ax.get(endpoint);
            return (response.data?.values ?? []) as HubControlSummary[];
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Lists the requirement versions for a named control, or [] if the control/requirement does not exist yet.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     */
    async getControlRequirementVersions(domain: string, controlName: string): Promise<string[]> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/requirement/versions`;
        try {
            const response = await this.ax.get(endpoint);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            if (err instanceof AxiosError && err.status === 404) {
                return [];
            }
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Gets a control requirement document at a specific version.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @param version Version label.
     */
    async getControlRequirementVersion(domain: string, controlName: string, version: string): Promise<object> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/requirement/versions/${version}`;
        try {
            const response = await this.ax.get(endpoint);
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Creates a control requirement version by POSTing the raw document to the versioned endpoint.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @param version Version label.
     * @param json Raw requirement document.
     * @returns The location of the created version.
     */
    async createControlRequirementVersion(domain: string, controlName: string, version: string, json: string): Promise<string> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/requirement/versions/${version}`;
        try {
            const response = await this.ax.post(endpoint, json);
            return (response.headers.location as string | undefined) ?? endpoint;
        } catch (err) {
            throw this.wrapError(err, `POST ${endpoint}`);
        }
    }

    /**
     * Lists the versions of a named control's configuration, or [] if the configuration does not exist yet.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @param configName Configuration name (slug).
     */
    async getControlConfigurationVersions(domain: string, controlName: string, configName: string): Promise<string[]> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/configurations/${configName}/versions`;
        try {
            const response = await this.ax.get(endpoint);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            if (err instanceof AxiosError && err.status === 404) {
                return [];
            }
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Gets a control configuration document at a specific version.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @param configName Configuration name (slug).
     * @param version Version label.
     */
    async getControlConfigurationVersion(domain: string, controlName: string, configName: string, version: string): Promise<object> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/configurations/${configName}/versions/${version}`;
        try {
            const response = await this.ax.get(endpoint);
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    /**
     * Creates a control configuration version by POSTing the raw document to the versioned endpoint.
     * @param domain Domain name.
     * @param controlName Control name (slug).
     * @param configName Configuration name (slug).
     * @param version Version label.
     * @param json Raw configuration document.
     * @returns The location of the created version.
     */
    async createControlConfigurationVersion(domain: string, controlName: string, configName: string, version: string, json: string): Promise<string> {
        const endpoint = `/calm/domains/${domain}/controls/${controlName}/configurations/${configName}/versions/${version}`;
        try {
            const response = await this.ax.post(endpoint, json);
            return (response.headers.location as string | undefined) ?? endpoint;
        } catch (err) {
            throw this.wrapError(err, `POST ${endpoint}`);
        }
    }

    async getNamespaceMappings(namespace: string, type: ResourceType): Promise<string[]> {
        this.logger.debug(`Getting mappings for namespace=${namespace} with type=${type ?? 'ANY'}`);
        const endpoint = `/calm/namespaces/${namespace}/${type}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received mappings response: ${JSON.stringify(response.data)}`);
            return (response.data?.values ?? []).map((item: { customId: string }) => item.customId);
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    async createMappedResourceVersion(
        metadata: DocumentMetadata,
        json: string): Promise<string> {
        const endpoint = `/calm/namespaces/${metadata.namespace}/${metadata.type}/${metadata.mapping}/versions/${metadata.version}`;

        const actualMetadata = extractDocumentMetadata(json);
        if (!actualMetadata) {
            throw new HubClientError(0, 'Failed to extract document metadata for mapping update', endpoint);
        }
        if (!actualMetadata.version) {
            actualMetadata.version = '1.0.0';
        }
        try {
            validateDocumentId(metadata, actualMetadata);
        } catch(error) {
            throw this.wrapError(error, `POST ${endpoint}`);
        }

        this.logger.debug(`Updating mapped resource in namespace=${metadata.namespace} with mappingId=${metadata.mapping}`);

        try {
            const response = await this.ax.post(endpoint, json);
            this.logger.debug(`Received update mapping response: ${JSON.stringify(response.headers)}`);
            return (response.headers.location as string | undefined) ?? endpoint;
        } catch (err) {
            throw this.wrapError(err, `POST ${endpoint}`);
        }
    }
    
    /**
     * Return the list of versions fo a resource, or [] if none exist.
     * @param namespace The namespace to query
     * @param mappingId The mapping ID to query versions for
     * @param resourceType The resource type that this mapping ID belongs to
     * @returns The list of versions of that resource, or an empty list if the resource doesn't exist
     */
    async getMappedResourceVersions(namespace: string, mappingId: string, resourceType: ResourceType): Promise<string[]> {
        this.logger.debug(`Getting mapped resource versions for namespace=${namespace}, resource type=${resourceType} and mappingId=${mappingId}`);
        const endpoint = `/calm/namespaces/${namespace}/${resourceType}/${mappingId}/versions`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received mapped resource versions response: ${JSON.stringify(response.data)}`);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            if (err instanceof AxiosError) {
                if (err.status === 404) {
                    return [];
                }
            }
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    async getMappedResourceLatestVersion(namespace: string, mappingId: string, resourceType: ResourceType): Promise<object> {
        this.logger.debug(`Getting latest version for namespace=${namespace}, resource type=${resourceType} and mappingId=${mappingId}`);
        const endpoint = `/calm/namespaces/${namespace}/${resourceType}/${mappingId}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received latest version response: ${JSON.stringify(response.data)}`);
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    async getMappedResourceByVersion(namespace: string, mappingId: string, version: string, resourceType: ResourceType): Promise<object> {
        this.logger.debug(`Getting version ${version} for namespace=${namespace}, resource type=${resourceType} and mappingId=${mappingId}`);
        const endpoint = `/calm/namespaces/${namespace}/${resourceType}/${mappingId}/versions/${version}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received version response: ${JSON.stringify(response.data)}`);
            return response.data as object;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
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
