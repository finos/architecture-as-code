import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { ConventionSummary, ConventionTypeSummary, NamespaceDefaultConvention } from '../model/convention.js';
import { apiClient } from './utils/api-client.js';

export class ConventionService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async fetchConventionTypes(): Promise<ConventionTypeSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/convention-types', { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = 'Error fetching convention types:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConventions(namespace: string, conventionType: string): Promise<ConventionSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/conventions/${encodeURIComponent(conventionType)}`, { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = `Error fetching ${conventionType} conventions for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /** Resolves to undefined when no namespace in the chain sets a default (Hub returns 404). */
    public async fetchNamespaceDefault(namespace: string, conventionType: string): Promise<NamespaceDefaultConvention | undefined> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/conventions/${encodeURIComponent(conventionType)}/default`, { headers })
            .then((res) => res.data as NamespaceDefaultConvention)
            .catch((error) => {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return undefined;
                }
                const errorMessage = `Error fetching the ${conventionType} default for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
