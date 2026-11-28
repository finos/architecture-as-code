import { AxiosInstance } from 'axios';
import { GroupedSearchResults } from '../model/search.js';
import { getAuthHeaders } from '../authService.js';
import { apiClient } from './utils/api-client.js';

export class SearchService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    public async search(query: string): Promise<GroupedSearchResults> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/search?q=${encodeURIComponent(query)}`, { headers })
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = 'Error performing search:';
                console.error(errorMessage, error);
                // A 400 explains a bad qualifier, so show it rather than a generic failure.
                const serverMessage = error?.response?.status === 400 ? error.response.data?.error : undefined;
                return Promise.reject(new SearchQueryError(serverMessage ?? errorMessage, Boolean(serverMessage)));
            });
    }
}

export class SearchQueryError extends Error {
    constructor(message: string, readonly userFacing: boolean) {
        super(message);
    }
}
