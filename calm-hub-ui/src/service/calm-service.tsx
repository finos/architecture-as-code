import axios, { AxiosInstance } from 'axios';
import { Data } from '../model/calm.js';
import { getAuthHeaders } from '../authService.js';

export class CalmService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create();
        }
    }

    async fetchNamespaces(): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get('/calm/namespaces', { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = 'Error fetching namespaces:';
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchPatternIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/patterns`, { headers })
            .then((res) => res.data.values.map((num: number) => num.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching pattern IDs for namespace ${namespace}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchFlowIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/flows`, { headers })
            .then((res) => res.data.values.map((id: number) => id.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching flow IDs for namespace ${namespace}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchArchitectureIDs(namespace: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/architectures`, { headers })
            .then((res) => res.data.values.map((id: number) => id.toString()))
            .catch((error) => {
                const errorMessage = `Error fetching architecture IDs for namespace ${namespace}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchPatternVersions(namespace: string, patternID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/patterns/${patternID}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for pattern ID ${patternID}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchFlowVersions(namespace: string, flowID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/flows/${flowID}/versions`, { headers })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for flow ID ${flowID}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchArchitectureVersions(namespace: string, architectureID: string): Promise<string[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/architectures/${architectureID}/versions`, {
                headers,
            })
            .then((res) => res.data.values)
            .catch((error) => {
                const errorMessage = `Error fetching versions for architecture ID ${architectureID}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchPattern(namespace: string, patternID: string, version: string): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/patterns/${patternID}/versions/${version}`, {
                headers,
            })
            .then((res) => ({
                id: patternID,
                version: version,
                calmType: 'Patterns',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching pattern for namespace ${namespace}, pattern ID ${patternID}, version ${version}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchFlow(namespace: string, flowID: string, version: string): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/namespaces/${namespace}/flows/${flowID}/versions/${version}`, {
                headers,
            })
            .then((res) => ({
                id: flowID,
                version: version,
                calmType: 'Flows',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching flow for namespace ${namespace}, flow ID ${flowID}, version ${version}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }

    async fetchArchitecture(
        namespace: string,
        architectureID: string,
        version: string
    ): Promise<Data> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(
                `/calm/namespaces/${namespace}/architectures/${architectureID}/versions/${version}`,
                { headers }
            )
            .then((res) => ({
                id: architectureID,
                version: version,
                calmType: 'Architectures',
                name: namespace,
                data: res.data,
            }))
            .catch((error) => {
                const errorMessage = `Error fetching architecture for namespace ${namespace}, architecture ID ${architectureID}, version ${version}:`;
                console.error(errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
