import axios, { AxiosInstance } from 'axios';
import { getToken } from '../../authService.js';

export class AdrService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create();
        }
    }
    /**
     * Fetch adr IDs for a given namespace and set them using the provided setter function.
     */
    async fetchAdrIDs(namespace: string) {
        return this.ax
            .get(`/calm/namespaces/${namespace}/adrs`, {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching adr IDs for namespace ${namespace}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /**
     * Fetch revisions for a given namespace and adr ID and set them using the provided setter function.
     */
    async fetchAdrRevisions(namespace: string, adrID: string) {
        return this.ax
            .get(`/calm/namespaces/${namespace}/adrs/${adrID}/revisions`, {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching revisions for ADR ID ${adrID}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    /**
     * Fetch a specific adr by namespace, adr ID, and revision, and set it using the provided setter function.
     */
    async fetchAdr(namespace: string, adrID: string, revision: string) {
        return this.ax
            .get(`/calm/namespaces/${namespace}/adrs/${adrID}/revisions/${revision}`, {
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                },
            })
            .then((res) => res.data)
            .catch((error) => {
                const errorMessage = `Error fetching adr for namespace ${namespace}, adr ID ${adrID}, revision ${revision}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
