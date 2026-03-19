import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../../authService.js';
import { CalmAdrMeta } from '@finos/calm-shared/src/view-model/adr.js';

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
    async fetchAdrIDs(namespace: string) : Promise<number[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/adrs`, {
                headers,
            })
            .then((res) => res.data.values)
            .catch((error) => {
                console.error('Error fetching adr IDs for namespace:', namespace, error);
                return Promise.reject(new Error('Error fetching adr IDs for namespace: ' + namespace));
            });
    }

    /**
     * Fetch revisions for a given namespace and adr ID and set them using the provided setter function.
     */
    async fetchAdrRevisions(namespace: string, adrID: string): Promise<number[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${encodeURIComponent(adrID)}/revisions`, {
                headers,
            })
            .then((res) => res.data.values)
            .catch((error) => {
                console.error('Error fetching revisions for ADR ID:', adrID, error);
                return Promise.reject(new Error('Error fetching revisions for ADR ID: ' + adrID));
            });
    }

    /**
     * Fetch a specific adr by namespace, adr ID, and revision, and set it using the provided setter function.
     */
    async fetchAdr(namespace: string, adrID: string, revision: string): Promise<CalmAdrMeta> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${encodeURIComponent(namespace)}/adrs/${encodeURIComponent(adrID)}/revisions/${encodeURIComponent(revision)}`, {
                headers,
            })
            .then((res) => res.data)
            .catch((error) => {
                console.error('Error fetching adr for namespace:', namespace, 'adr ID:', adrID, 'revision:', revision, error);
                return Promise.reject(new Error('Error fetching adr for namespace: ' + namespace + ', adr ID: ' + adrID + ', revision: ' + revision));
            });
    }
}
