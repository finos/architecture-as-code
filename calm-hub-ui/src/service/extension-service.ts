import { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { ExtensionScreen, ExtensionSummary } from '../model/extensions.js';
import { apiClient } from './utils/api-client.js';

export class ExtensionService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async fetchExtensions(): Promise<ExtensionSummary[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/extensions', { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = 'Error fetching extensions:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    public async fetchScreen(id: string): Promise<ExtensionScreen> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/api/calm/extensions/${encodeURIComponent(id)}/screen`, { headers })
            .then((res) => {
                if (!Array.isArray(res.data?.blocks)) {
                    throw new Error('The screen has no blocks');
                }
                return res.data as ExtensionScreen;
            })
            .catch((error) => {
                const errorMessage = `Error fetching the screen of extension ${id}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
