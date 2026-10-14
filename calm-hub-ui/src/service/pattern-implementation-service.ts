import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';
import { PatternImplementation } from '../model/pattern-implementation.js';
import { apiClient } from './utils/api-client.js';

export class PatternImplementationService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = apiClient;
        }
    }

    /**
     * Lists the architecture versions whose `$schema` names this pattern version.
     * Resolves to null when the hub does not support the lookup: GitHub storage mode answers 501.
     */
    public async fetchImplementations(
        namespace: string,
        patternName: string,
        version: string
    ): Promise<PatternImplementation[] | null> {
        const headers = await getAuthHeaders();
        const path =
            `/calm/namespaces/${encodeURIComponent(namespace)}/patterns/${encodeURIComponent(patternName)}` +
            `/versions/${encodeURIComponent(version)}/implementations`;
        return this.ax
            .get(path, { headers })
            .then((res) => (Array.isArray(res.data?.implementations) ? res.data.implementations : []))
            .catch((error) => {
                if (axios.isAxiosError(error) && error.response?.status === 501) {
                    return null;
                }
                const errorMessage = `Error fetching implementations of pattern ${patternName}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
