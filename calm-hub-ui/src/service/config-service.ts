import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { ConfigSummary, ConfigTypeSummary, NamespaceDefaultConfig } from '../model/config.js';
import { apiClient } from './utils/api-client.js';

export class ConfigService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async fetchConfigTypes(): Promise<ConfigTypeSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/config-types', { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = 'Error fetching config types:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchConfigs(namespace: string, configType: string): Promise<ConfigSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/configs/${encodeURIComponent(configType)}`, { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = `Error fetching ${configType} configs for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /** Resolves to undefined when no namespace in the chain sets a default (Hub returns 404). */
    public async fetchNamespaceDefault(namespace: string, configType: string): Promise<NamespaceDefaultConfig | undefined> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/namespaces/${encodeURIComponent(namespace)}/configs/${encodeURIComponent(configType)}/default`, { headers })
            .then((res) => res.data as NamespaceDefaultConfig)
            .catch((error) => {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return undefined;
                }
                const errorMessage = `Error fetching the ${configType} default for namespace ${namespace}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
