import { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { UiConfig } from '../model/ui-config.js';
import { apiClient } from './utils/api-client.js';

export class UiConfigService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        this.ax = axiosInstance ?? apiClient;
    }

    public async getUiConfig(): Promise<UiConfig> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/api/calm/ui/config', { headers })
            .then((res) => (res.data && typeof res.data === 'object' ? res.data : {}))
            .catch((error) => {
                const errorMessage = 'Error fetching UI config:';
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
