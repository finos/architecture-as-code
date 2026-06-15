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

export interface HubControlRequirementSummary {
    'control-id': number;
    name: string;
    description?: string;
    versions: string[];
}
    
export type ResourceChangeType = 'MAJOR' | 'MINOR' | 'PATCH';

export type ResourceType = 'patterns' | 'architectures' | 'standards' | 'interfaces';
export const RESOURCE_TYPES = ['patterns', 'architectures', 'standards', 'interfaces'];

export function isValidResourceType(input: string): input is ResourceType {
    return RESOURCE_TYPES.includes(input);
}

export function convertResourceTypeForCalmHubUrl(rt: ResourceType): string {
    // return (rt as string) + 's';
    return rt as string;
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
        const endpoint = `POST /api/calm/domains/${domain}/controls`;
        try {
            const response = await this.ax.post(`/api/calm/domains/${domain}/controls`, { name, description, requirementJson });
            const location = (response.headers['location'] as string | undefined) ?? `/api/calm/domains/${domain}/controls`;
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
        const endpoint = `GET /api/calm/domains/${domain}/controls`;
        try {
            const response = await this.ax.get(`/api/calm/domains/${domain}/controls`);
            const values: HubControlSummary[] = response.data?.values ?? [];
            return values;
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    /**
     * Lists control requirements and their versions for a domain.
     * @param domain Domain name.
     * @returns Control requirement summaries.
     */
    async listControlRequirements(domain: string): Promise<HubControlRequirementSummary[]> {
        const endpoint = `GET /api/calm/domains/${domain}/controls`;
        try {
            const controls = await this.listControls(domain);
            const summaries = await Promise.all(
                controls.map(async (control) => {
                    const versionsEndpoint = `GET /api/calm/domains/${domain}/controls/${control.id}/requirement/versions`;
                    try {
                        const versions = await this.listControlRequirementVersions(domain, control.id);
                        return {
                            'control-id': control.id,
                            name: control.name,
                            description: control.description,
                            versions
                        };
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
        const endpoint = `POST /api/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
        // print debug all parameters except requirementJson which may be large
        console.debug(`pushControlRequirement called with domain=${domain}, controlId=${controlId}, version=${version}, name=${name}, description=${description}`);
        // print debug first 200 characters of requirementJson
        console.debug(`requirementJson: ${requirementJson.substring(0, 200)}${requirementJson.length > 200 ? '... (truncated)' : ''}`);
        try {
            const response = await this.ax.post(
                `/api/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`,
                { name, description, requirementJson },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/api/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
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
        const endpoint = `GET /api/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/api/calm/domains/${domain}/controls/${controlId}/requirement/versions/${version}`
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
        const endpoint = `POST /api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
        try {
            const response = await this.ax.post(
                `/api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`,
                { configurationJson: configJson },
                { headers: { 'Content-Type': 'application/json' } }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
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
        const endpoint = `GET /api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`;
        try {
            const response = await this.ax.get(
                `/api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions/${version}`
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
        const endpoint = `POST /api/calm/domains/${domain}/controls/${controlId}/configurations`;
        try {
            const response = await this.ax.post(
                `/api/calm/domains/${domain}/controls/${controlId}/configurations`,
                { configurationJson }
            );
            const location = (response.headers['location'] as string | undefined)
                ?? `/api/calm/domains/${domain}/controls/${controlId}/configurations`;
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
        const endpoint = `GET /api/calm/domains/${domain}/controls/${controlId}/configurations`;
        try {
            const response = await this.ax.get(`/api/calm/domains/${domain}/controls/${controlId}/configurations`);
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
        const endpoint = `GET /api/calm/domains/${domain}/controls/${controlId}/requirement/versions`;
        try {
            const response = await this.ax.get(`/api/calm/domains/${domain}/controls/${controlId}/requirement/versions`);
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
        const endpoint = `GET /api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`;
        try {
            const response = await this.ax.get(`/api/calm/domains/${domain}/controls/${controlId}/configurations/${configId}/versions`);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            throw this.wrapError(err, endpoint);
        }
    }

    async getNamespaceMappings(namespace: string, type: ResourceType): Promise<string[]> {
        this.logger.debug(`Getting mappings for namespace=${namespace} with type=${type ?? 'ANY'}`);
        const endpoint = `/calm/namespaces/${namespace}/${convertResourceTypeForCalmHubUrl(type)}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received mappings response: ${JSON.stringify(response.data)}`);
            return (response.data?.values ?? []) as string[];
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    async createMappedResourceVersion(
            metadata: DocumentMetadata,
            json: string): Promise<string> {
        const endpoint = `/calm/namespaces/${metadata.namespace}/${convertResourceTypeForCalmHubUrl(metadata.type)}/${metadata.mapping}/versions/${metadata.version}`;

        const actualMetadata = extractDocumentMetadata(json);
        if (!actualMetadata) {
            throw new HubClientError(0, 'Failed to extract document metadata for mapping update', endpoint);
        }
        if (!actualMetadata.version) {
            actualMetadata.version = '1.0.0';
        }
        try {
            validateDocumentId(metadata, actualMetadata)
        } catch(error) {
            throw this.wrapError(error, `POST ${endpoint}`);
        }

        this.logger.debug(`Updating mapped resource in namespace=${metadata.namespace} with mappingId=${metadata.mapping}`);

        // TODO handle name/description

        try {
            const response = await this.ax.post(endpoint, json);
            this.logger.debug(`Received update mapping response: ${JSON.stringify(response.headers)}`);
            return response.headers.location as string;
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
        const endpoint = `/calm/namespaces/${namespace}/${convertResourceTypeForCalmHubUrl(resourceType)}/${mappingId}/versions`;
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

    async getMappedResourceLatestVersion(namespace: string, mappingId: string, resourceType: ResourceType): Promise<string> {
        this.logger.debug(`Getting latest version for namespace=${namespace}, resource type=${resourceType} and mappingId=${mappingId}`);
        const endpoint = `/calm/namespaces/${namespace}/${convertResourceTypeForCalmHubUrl(resourceType)}/${mappingId}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received latest version response: ${JSON.stringify(response.data)}`);
            return response.data as string;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }

    async getMappedResourceByVersion(namespace: string, mappingId: string, version: string, resourceType: ResourceType): Promise<string> {
        this.logger.debug(`Getting version ${version} for namespace=${namespace}, resource type=${resourceType} and mappingId=${mappingId}`);
        const endpoint = `/calm/namespaces/${namespace}/${convertResourceTypeForCalmHubUrl(resourceType)}/${mappingId}/versions/${version}`;
        try {
            const response = await this.ax.get(endpoint);
            this.logger.debug(`Received version response: ${JSON.stringify(response.data)}`);
            return response.data as string;
        } catch (err) {
            throw this.wrapError(err, `GET ${endpoint}`);
        }
    }
    


    

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Parses id and version from a Location header of the form
     * /api/calm/namespaces/{ns}/{resource-type}/{id}/versions/{version}
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
     * /api/calm/.../{id} or /api/calm/.../{id}/
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
