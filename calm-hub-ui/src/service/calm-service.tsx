import { AxiosInstance } from 'axios';
import type { CalmTimelineSchema } from '@finos/calm-models/types';
import { Data, ResourceSummary, ResourceMapping } from '../model/calm.js';
import { getAuthHeaders } from '../authService.js';
import { Decorator } from '../visualizer/contracts/decorator-contracts.js';
import { apiClient } from './utils/api-client.js';

/**
 * Service for interacting with CALM API endpoints.
 * 
 * TODO: Add type safety for API responses by:
 * - Defining response interfaces (e.g., NamespacesResponse, PatternIDsResponse)
 * - Validating responses at runtime (e.g., with Zod or similar validation library)
 * - Using typed axios responses to ensure type safety throughout the call chain
 */
export class CalmService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    public async fetchNamespaces(): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/namespaces', { headers })
            .then((res) => {
                const namespaces = (res.data?.values ?? [])
                    .map((v: { name?: string }) => v?.name)
                    .filter((name: string | undefined): name is string => !!name);
                return namespaces;
            })
            .catch((error) => {
                const errorMessage = 'Error fetching namespaces:';
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchPatternSummaries(namespace: string): Promise<ResourceSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/patterns`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching patterns for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchFlowSummaries(namespace: string): Promise<ResourceSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/flows`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching flows for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchArchitectureSummaries(namespace: string): Promise<ResourceSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching architectures for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchPatternVersions(namespace: string, patternID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${namespace}/patterns/${patternID}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for pattern ID ${patternID}:`;
                // arg1 is %s to prevent format string injection from `patternID`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchFlowVersions(namespace: string, flowID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${namespace}/flows/${flowID}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for flow ID ${flowID}:`;
                // arg1 is %s to prevent format string injection from `flowID`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchArchitectureVersions(namespace: string, architectureID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${namespace}/architectures/${architectureID}/versions`, {
                headers,
            })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for architecture ID ${architectureID}:`;
                // arg1 is %s to prevent format string injection from `architectureID`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchPattern(namespace: string, patternID: string, version: string): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`, {
                headers,
            })
            .then((res) => ({
                id: patternID,
                version: version,
                calmType: 'Patterns',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching pattern for namespace ${namespace}, pattern ID ${patternID}, version ${version}:`;
                // arg1 is %s to prevent format string injection from `namespace`, `patternID`, and `version`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchFlow(namespace: string, flowID: string, version: string): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${namespace}/flows/${flowID}/versions/${version}`, {
                headers,
            })
            .then((res) => ({
                id: flowID,
                version: version,
                calmType: 'Flows',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching flow for namespace ${namespace}, flow ID ${flowID}, version ${version}:`;
                // arg1 is %s to prevent format string injection from `namespace`, `flowID`, and `version`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchArchitecture(
        namespace: string,
        architectureID: string,
        version: string
    ): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(
                `/api/calm/namespaces/${namespace}/architectures/${architectureID}/versions/${version}`,
                { headers }
            )
            .then((res) => ({
                id: architectureID,
                version: version,
                calmType: 'Architectures',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching architecture for namespace ${namespace}, architecture ID ${architectureID}, version ${version}:`;
                // arg1 is %s to prevent format string injection from `namespace`, `architectureID`, and `version`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchStandardSummaries(namespace: string): Promise<ResourceSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/standards`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching standards for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchStandardVersions(namespace: string, standardID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${standardID}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for standard ID ${standardID}:`;
                // arg1 is %s to prevent format string injection from `standardID`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchStandard(namespace: string, standardID: string, version: string): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/standards/${standardID}/versions/${version}`,
                { headers }
            )
            .then((res) => ({
                id: standardID,
                version: version,
                calmType: 'Standards',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching standard for namespace ${namespace}, standard ID ${standardID}, version ${version}:`;
                // arg1 is %s to prevent format string injection from `namespace`, `standardID`, and `version`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    // --- Timelines ---

    /**
     * Fetch the timeline for an architecture. Returns the explicit timeline if
     * one references this architecture; otherwise the backend returns an implied
     * timeline projected from the architecture's version history. Either way the
     * response is a `calm-timeline.json` document describing each version as a
     * moment.
     */
    public async fetchArchitectureTimeline(
        namespace: string,
        architectureID: string
    ): Promise<CalmTimelineSchema> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(
                `/api/calm/namespaces/${encodeURIComponent(namespace)}/architectures/${encodeURIComponent(architectureID)}/timeline`,
                { headers }
            )
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = `Error fetching timeline for architecture ID ${architectureID}:`;
                // arg1 is %s to prevent format string injection from `architectureID`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /**
     * Fetch decorator values for a given namespace with optional target and type filters.
    */
    public async fetchDecoratorValues(
        namespace: string,
        target?: string,
        type?: string
    ): Promise<Decorator[]> {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        if (target) params.set('target', target);
        if (type) params.set('type', type);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/decorators/values${query}`, { headers })
            .then((res) => res.data.values ?? [])
            .catch((error) => {
                const errorMessage = `Error fetching decorator values for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return [];
            });
    }

    // --- Front Controller API (name-based / slug-based access) ---

    /** Maps a calmType (e.g. 'Patterns') or a resource-type enum value (e.g. 'PATTERN')
     *  to the plural URL path segment used by the name-based API. */
    private calmTypeToPath(calmType: string): string {
        switch (calmType.toUpperCase()) {
            case 'ARCHITECTURE': case 'ARCHITECTURES': return 'architectures';
            case 'PATTERN':      case 'PATTERNS':      return 'patterns';
            case 'FLOW':         case 'FLOWS':         return 'flows';
            case 'STANDARD':     case 'STANDARDS':     return 'standards';
            case 'INTERFACE':    case 'INTERFACES':    return 'interfaces';
            default: return calmType.toLowerCase();
        }
    }

    /** Fetches all named resources of a given type from the name-based namespace API. */
    public async fetchMappings(namespace: string, type?: string): Promise<ResourceMapping[]> {
        const headers = await getAuthHeaders();
        if (!type) {
            return [];
        }
        const pluralType = this.calmTypeToPath(type);
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/${pluralType}`, { headers })
            .then((res) => {
                return Array.isArray(res.data?.values) ? res.data.values : [];
            })
            .catch((error) => {
                const errorMessage = `Error fetching mappings for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return [];
            });
    }

    /** Fetches the list of versions for a named (slug) resource. */
    public async fetchVersionsByCustomId(namespace: string, customId: string, calmType: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        const typePath = this.calmTypeToPath(calmType);
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/${typePath}/${encodeURIComponent(customId)}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for custom ID ${customId}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /** Fetches a specific version of a named (slug) resource. */
    public async fetchResourceByCustomId(namespace: string, customId: string, version: string, calmType: string): Promise<Data> {
        const headers = await getAuthHeaders();
        const typePath = this.calmTypeToPath(calmType);
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/${typePath}/${encodeURIComponent(customId)}/versions/${encodeURIComponent(version)}`, { headers })
            .then((res) => ({
                id: customId,
                version: version,
                calmType: calmType as Data['calmType'],
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching resource ${customId} version ${version}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}