import axios, { AxiosInstance } from 'axios';
import { GroupedSearchResults } from '../model/search.js';
import { getAuthHeaders } from '../authService.js';

export class SearchService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create();
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
                return Promise.reject(new Error(errorMessage));
            });
    }
}
