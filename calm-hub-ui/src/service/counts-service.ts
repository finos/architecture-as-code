import { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { NamespaceCounts, DomainControlCount } from '../model/counts.js';
import { apiClient } from './utils/api-client.js';

/**
 * Fetches the aggregate counts used by the browse rail and namespace page:
 * per-namespace resource counts and per-domain control counts. Follows the
 * class + injectable-Axios service pattern (defaults to the shared apiClient).
 */
export class CountsService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    public async fetchNamespaceCounts(): Promise<NamespaceCounts[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/namespaces/counts', { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = 'Error fetching namespace counts:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchDomainCounts(): Promise<DomainControlCount[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/domains/counts', { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = 'Error fetching domain counts:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
