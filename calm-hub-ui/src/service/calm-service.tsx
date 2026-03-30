import axios, { AxiosInstance } from 'axios';
import { Data } from '../model/calm.js';
import { getAuthHeaders } from '../authService.js';
import { Decorator } from '../visualizer/contracts/decorator-contracts.js';

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
            this.ax = axios.create();
        }
    }

    public async fetchNamespaces(): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/calm/namespaces', { headers })
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

    public async fetchPatternIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/patterns`, { headers })
            .then((res) => res.data.values.map((num: number) => num.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching pattern IDs for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchFlowIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/flows`, { headers })
            .then((res) => res.data.values.map((id: number) => id.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching flow IDs for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchArchitectureIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/architectures`, { headers })
            .then((res) => res.data.values.map((id: number) => id.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching architecture IDs for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchPatternVersions(namespace: string, patternID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/patterns/${patternID}/versions`, { headers })
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
            .get(`/calm/namespaces/${namespace}/flows/${flowID}/versions`, { headers })
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
            .get(`/calm/namespaces/${namespace}/architectures/${architectureID}/versions`, {
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
            .get(`/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`, {
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
            .get(`/calm/namespaces/${namespace}/flows/${flowID}/versions/${version}`, {
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
                `/calm/namespaces/${namespace}/architectures/${architectureID}/versions/${version}`,
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
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/decorators/values${query}`, { headers })
            .then((res) => res.data.values ?? [])
            .catch((error) => {
                const errorMessage = `Error fetching decorator values for namespace ${namespace}:`;
                // arg1 is %s to prevent format string injection from `namespace`.
                console.error('%s', errorMessage, error);
                return [];
            });
    }
}